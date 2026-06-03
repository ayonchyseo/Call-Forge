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

const JWT_SECRET = process.env.JWT_SECRET || "callforge-dev-secret-change-me";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!process.env.JWT_SECRET) {
  console.log("⚠  JWT_SECRET not set — using a dev fallback. Set JWT_SECRET so logins survive restarts.");
}

// Strip secrets before returning a user to the browser.
function publicUser(u) {
  return { id: u.id, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt };
}

function signToken(user) {
  return jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
}

// Require a valid token for an APPROVED account. Attaches req.user.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Please sign in." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await store.getUserById(payload.uid);
    if (!user) return res.status(401).json({ error: "Account no longer exists." });
    if (user.status !== "approved") return res.status(403).json({ error: "Your account is not approved yet." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Your session expired — please sign in again." });
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
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
    if (await store.getUserByEmail(email)) return res.status(409).json({ error: "An account with this email already exists." });

    const passwordHash = await bcrypt.hash(password, 10);
    await store.createUser({ email, passwordHash, role: "client", status: "pending" });
    res.json({ ok: true, status: "pending", message: "Account created. An admin will approve it shortly." });
  });

  // ── log in ──────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
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
  });

  // ── who am I ────────────────────────────────────────────────────────────────
  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  // ── admin: list / approve / reject / role / delete ──────────────────────────
  app.get("/api/admin/users", requireAuth, requireAdmin, async (_req, res) => {
    const users = await store.listUsers();
    res.json({ users: users.map(publicUser) });
  });

  app.post("/api/admin/users/:id/approve", requireAuth, requireAdmin, async (req, res) => {
    const u = await store.setUserStatus(req.params.id, "approved");
    if (!u) return res.status(404).json({ error: "User not found." });
    res.json({ user: publicUser(u) });
  });

  app.post("/api/admin/users/:id/reject", requireAuth, requireAdmin, async (req, res) => {
    if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't reject your own account." });
    const u = await store.setUserStatus(req.params.id, "rejected");
    if (!u) return res.status(404).json({ error: "User not found." });
    res.json({ user: publicUser(u) });
  });

  app.post("/api/admin/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
    const role = req.body?.role === "admin" ? "admin" : "client";
    if (req.params.id === req.user.id && role !== "admin") {
      return res.status(400).json({ error: "You can't remove your own admin access." });
    }
    const u = await store.setUserRole(req.params.id, role);
    if (!u) return res.status(404).json({ error: "User not found." });
    res.json({ user: publicUser(u) });
  });

  app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't delete your own account." });
    await store.deleteUser(req.params.id);
    res.json({ ok: true });
  });
}
