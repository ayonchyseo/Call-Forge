// CallForge — authentication & admin-approval routes.
//
// Flow (no email verification — admin approves manually):
//   signup  → account created with status 'pending'
//   admin   → approves/rejects pending accounts in the dashboard
//   login   → only 'approved' accounts get a token; 'pending'/'rejected' are told why
//
// Tokens are stateless JWTs (30 days). Set JWT_SECRET in production so tokens
// stay valid across restarts; otherwise a dev fallback is used.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as store from "./store.js";
import * as platform from "./twilioPlatform.js";

const JWT_SECRET = process.env.JWT_SECRET || "callforge-dev-secret-change-me";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!process.env.JWT_SECRET) {
  console.log("⚠  JWT_SECRET not set — using a dev fallback. Set JWT_SECRET so logins survive restarts.");
}

// Strip secrets before returning a user to the browser. (`twilio.subaccountSid`
// and the encrypted token never leave the server — only the bits the UI needs
// to show "Your number: +1... ✓ ready" / "setting up" / "failed: <reason>".)
function publicUser(u) {
  return {
    id: u.id, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt,
    twilio: { status: u.twilio?.status || "none", phoneNumber: u.twilio?.phoneNumber || "", error: u.twilio?.error || "" },
  };
}

function signToken(user) {
  return jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
}

// ── platform-Twilio auto-provisioning ────────────────────────────────────────
// Runs AFTER the HTTP response so an admin approving someone isn't stuck
// waiting ~10-20s on Twilio's API; the user's Settings page shows
// `twilio.status` (pending → active/failed) once they refresh.
async function provisionNow(user) {
  try {
    const result = await platform.provisionUser(user);
    await store.setTwilioAccount(user.id, result);
    console.log(`✅ Twilio number ${result.phoneNumber} provisioned for ${user.email} (subaccount ${result.subaccountSid})`);
  } catch (err) {
    console.error(`✗ Twilio provisioning failed for ${user.email}: ${err.message}`);
    await store.setTwilioStatus(user.id, "failed", err.message);
  }
}

// Auto-trigger on approval — only when platform mode is on, and only once
// (skips users who already have an active number or a provision in flight).
function maybeProvision(user) {
  if (!platform.platformEnabled) return;
  if (user.twilio?.status === "active" || user.twilio?.status === "pending") return;
  store.setTwilioStatus(user.id, "pending").then(() => provisionNow(user));
}

// Require a valid token for an APPROVED account. Attaches req.user.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Please sign in." });

  // Verify the JWT signature/expiry first. This throws JsonWebTokenError or
  // TokenExpiredError for a bad/expired token — those are real 401s.
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Your session expired — please sign in again." });
  }

  // Look up the user separately so a DB/store error returns 503, not 401.
  // Returning 401 on a store error would cause the frontend to log the user
  // out and delete their token even though their credentials are perfectly valid.
  try {
    const user = await store.getUserById(payload.uid);
    if (!user) return res.status(401).json({ error: "Account no longer exists." });
    if (user.status !== "approved") return res.status(403).json({ error: "Your account is not approved yet." });
    req.user = user;
    next();
  } catch (err) {
    console.error("requireAuth: store error:", err.message);
    return res.status(503).json({ error: "Authentication service temporarily unavailable. Please try again." });
  }
}

// Require the authenticated user to be an admin. Use after requireAuth.
export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admins only." });
  next();
}

export function setupAuth(app) {
  // ── sign up ───────────────────────────────────────────────────────────────
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
      if (await store.getUserByEmail(email)) return res.status(409).json({ error: "An account with this email already exists." });

      const passwordHash = await bcrypt.hash(password, 10);
      await store.createUser({ email, passwordHash, role: "client", status: "pending" });
      res.json({ ok: true, status: "pending", message: "Account created. An admin will approve it shortly." });
    } catch (err) {
      console.error("Signup error:", err.message);
      res.status(503).json({ error: "Signup temporarily unavailable. Please try again." });
    }
  });

  // ── log in ──────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      const user = await store.getUserByEmail(email);
      // Same generic message for unknown email vs wrong password (don't leak which).
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "Wrong email or password." });
      }
      if (user.status === "pending") return res.status(403).json({ error: "Your account is awaiting admin approval.", status: "pending" });
      if (user.status === "rejected") return res.status(403).json({ error: "Your account request was declined.", status: "rejected" });
      res.json({ token: signToken(user), user: publicUser(user) });
    } catch (err) {
      console.error("Login error:", err.message);
      res.status(503).json({ error: "Login temporarily unavailable. Please try again." });
    }
  });

  // ── who am I ────────────────────────────────────────────────────────────────
  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  // ── admin: list / approve / reject / role / delete ──────────────────────────
  app.get("/api/admin/users", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const users = await store.listUsers();
      res.json({ users: users.map(publicUser) });
    } catch (err) {
      console.error("Admin listUsers error:", err.message);
      res.status(503).json({ error: "Could not load users. Please try again." });
    }
  });

  app.post("/api/admin/users/:id/approve", requireAuth, requireAdmin, async (req, res) => {
    try {
      const u = await store.setUserStatus(req.params.id, "approved");
      if (!u) return res.status(404).json({ error: "User not found." });
      res.json({ user: publicUser(u) });
      maybeProvision(u); // fire-and-forget: subaccount + number show up shortly after
    } catch (err) {
      console.error("Admin approve error:", err.message);
      res.status(503).json({ error: "Could not approve user. Please try again." });
    }
  });

  app.post("/api/admin/users/:id/reject", requireAuth, requireAdmin, async (req, res) => {
    try {
      if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't reject your own account." });
      const u = await store.setUserStatus(req.params.id, "rejected");
      if (!u) return res.status(404).json({ error: "User not found." });
      res.json({ user: publicUser(u) });
    } catch (err) {
      console.error("Admin reject error:", err.message);
      res.status(503).json({ error: "Could not reject user. Please try again." });
    }
  });

  app.post("/api/admin/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
    try {
      const role = req.body?.role === "admin" ? "admin" : "client";
      if (req.params.id === req.user.id && role !== "admin") {
        return res.status(400).json({ error: "You can't remove your own admin access." });
      }
      const u = await store.setUserRole(req.params.id, role);
      if (!u) return res.status(404).json({ error: "User not found." });
      res.json({ user: publicUser(u) });
    } catch (err) {
      console.error("Admin setRole error:", err.message);
      res.status(503).json({ error: "Could not update role. Please try again." });
    }
  });

  // Retry Twilio provisioning by hand (e.g. after a transient Twilio error, or
  // "no numbers available in that area code" — fix PLATFORM_NUMBER_AREA_CODE
  // and retry). Re-runs even for a `failed` user; no-ops if platform mode is off.
  app.post("/api/admin/users/:id/provision", requireAuth, requireAdmin, async (req, res) => {
    try {
      if (!platform.platformEnabled) return res.status(400).json({ error: "Platform Twilio isn't configured on this server (set PLATFORM_TWILIO_SID/PLATFORM_TWILIO_TOKEN)." });
      const u = await store.getUserById(req.params.id);
      if (!u) return res.status(404).json({ error: "User not found." });
      await store.setTwilioStatus(u.id, "pending");
      res.json({ ok: true, status: "pending" });
      provisionNow(u);
    } catch (err) {
      console.error("Admin provision error:", err.message);
      res.status(503).json({ error: "Could not start provisioning. Please try again." });
    }
  });

  app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't delete your own account." });
      await store.deleteUser(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      console.error("Admin deleteUser error:", err.message);
      res.status(503).json({ error: "Could not delete user. Please try again." });
    }
  });
}
