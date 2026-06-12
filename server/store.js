// CallForge — durable user store for accounts + admin approval.
//
// Two backends, same async API:
//   • Postgres  — used automatically when DATABASE_URL is set (durable; survives
//                 redeploys on Render/Railway/etc). Recommended for production.
//   • JSON file — zero-config fallback so the app runs out of the box. ⚠ This file
//                 lives on the container's ephemeral disk, so on hosts like Render
//                 it is wiped on every redeploy. Fine for local dev / trying it out;
//                 set DATABASE_URL before you start selling access.
//
// A user looks like:
//   { id, email, passwordHash, role: 'admin'|'client', status: 'pending'|'approved'|'rejected', createdAt }

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, "data", "users.json");
const DATABASE_URL = process.env.DATABASE_URL || "";

let pool = null;          // pg pool when in Postgres mode
let mode = "file";        // 'pg' | 'file'

// ── helpers ─────────────────────────────────────────────────────────────────
const newId = () => crypto.randomUUID();
const normEmail = (e) => String(e || "").trim().toLowerCase();

// Twilio subaccount auth tokens are secrets we must hand back to Twilio's API
// later — unlike passwords they can't be one-way hashed. AES-256-GCM with a
// server-side key keeps them unreadable in the DB/JSON file without it.
const ENCRYPTION_KEY = crypto.createHash("sha256")
  .update(process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "callforge-dev-secret-change-me")
  .digest();
if (!process.env.ENCRYPTION_KEY) {
  console.log("⚠  ENCRYPTION_KEY not set — Twilio subaccount tokens fall back to JWT_SECRET (or a dev key) for encryption.");
  console.log("   Set ENCRYPTION_KEY to a long random string in production so they stay decryptable across secret rotations.");
}

export function encryptSecret(plaintext) {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptSecret(blob) {
  if (!blob) return "";
  try {
    const buf = Buffer.from(blob, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function rowToUser(r) {
  if (!r) return null;
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    role: r.role,
    status: r.status,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    twilio: {
      status: r.twilio_status || "none",                 // none|pending|active|failed
      subaccountSid: r.twilio_subaccount_sid || "",
      subaccountTokenEnc: r.twilio_subaccount_token_enc || "",
      phoneNumber: r.twilio_phone_number || "",
      error: r.twilio_error || "",
    },
  };
}

// ── file backend ────────────────────────────────────────────────────────────
// Older file-store records predate the `twilio` field — backfill it on read so
// every caller can rely on `user.twilio.status` always being present.
function normalizeUser(u) {
  return {
    ...u,
    twilio: { status: "none", subaccountSid: "", subaccountTokenEnc: "", phoneNumber: "", error: "", ...(u.twilio || {}) },
  };
}
function readFileUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")).map(normalizeUser); } catch { return []; }
}
function writeFileUsers(users) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ── init ────────────────────────────────────────────────────────────────────
export async function init() {
  if (DATABASE_URL) {
    const { default: pg } = await import("pg");
    pool = new pg.Pool({
      connectionString: DATABASE_URL,
      // Managed Postgres (Neon/Supabase/Render) needs SSL; local doesn't.
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        email         TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'client',
        status        TEXT NOT NULL DEFAULT 'pending',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    // Added for the platform-Twilio model (auto-provisioned subaccount + phone
    // number per user — see twilioPlatform.js). ALTER..IF NOT EXISTS so existing
    // deployments pick these up in place, with no destructive migration.
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS twilio_status TEXT NOT NULL DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS twilio_subaccount_sid TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS twilio_subaccount_token_enc TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS twilio_phone_number TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS twilio_error TEXT NOT NULL DEFAULT ''
    `);
    mode = "pg";
    console.log("ℹ  User store: Postgres (durable).");
  } else {
    mode = "file";
    if (!fs.existsSync(USERS_FILE)) writeFileUsers([]);
    console.log("⚠  User store: local JSON file. Accounts/approvals are NOT durable on hosts");
    console.log("   like Render (wiped on redeploy). Set DATABASE_URL to a Postgres URL for production.");
  }
  await ensureAdmin();
}

// ── reads ───────────────────────────────────────────────────────────────────
export async function getUserByEmail(email) {
  const e = normEmail(email);
  if (mode === "pg") {
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [e]);
    return rowToUser(rows[0]);
  }
  return readFileUsers().find((u) => u.email === e) || null;
}

export async function getUserById(id) {
  if (mode === "pg") {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return rowToUser(rows[0]);
  }
  return readFileUsers().find((u) => u.id === id) || null;
}

export async function listUsers() {
  if (mode === "pg") {
    const { rows } = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
    return rows.map(rowToUser);
  }
  return readFileUsers().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// ── writes ──────────────────────────────────────────────────────────────────
export async function createUser({ email, passwordHash, role = "client", status = "pending" }) {
  const user = {
    id: newId(),
    email: normEmail(email),
    passwordHash,
    role,
    status,
    createdAt: new Date().toISOString(),
    twilio: { status: "none", subaccountSid: "", subaccountTokenEnc: "", phoneNumber: "", error: "" },
  };
  if (mode === "pg") {
    await pool.query(
      "INSERT INTO users (id, email, password_hash, role, status, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [user.id, user.email, user.passwordHash, user.role, user.status, user.createdAt],
    );
  } else {
    const users = readFileUsers();
    users.push(user);
    writeFileUsers(users);
  }
  return user;
}

export async function setUserStatus(id, status) {
  if (mode === "pg") {
    const { rows } = await pool.query("UPDATE users SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
    return rowToUser(rows[0]);
  }
  const users = readFileUsers();
  const u = users.find((x) => x.id === id);
  if (!u) return null;
  u.status = status;
  writeFileUsers(users);
  return u;
}

export async function setUserRole(id, role) {
  if (mode === "pg") {
    const { rows } = await pool.query("UPDATE users SET role = $1 WHERE id = $2 RETURNING *", [role, id]);
    return rowToUser(rows[0]);
  }
  const users = readFileUsers();
  const u = users.find((x) => x.id === id);
  if (!u) return null;
  u.role = role;
  writeFileUsers(users);
  return u;
}

// ── platform-Twilio provisioning state (see twilioPlatform.js) ─────────────
// Two purpose-built mutations rather than one generic patcher: the caller
// always knows the full new state it wants (mid-flight vs. final), so there's
// no partial-update ambiguity to handle.
export async function setTwilioStatus(id, status, error = "") {
  if (mode === "pg") {
    const { rows } = await pool.query(
      "UPDATE users SET twilio_status = $1, twilio_error = $2 WHERE id = $3 RETURNING *",
      [status, error, id],
    );
    return rowToUser(rows[0]);
  }
  const users = readFileUsers();
  const u = users.find((x) => x.id === id);
  if (!u) return null;
  u.twilio = { ...u.twilio, status, error };
  writeFileUsers(users);
  return u;
}

export async function setTwilioAccount(id, { subaccountSid, subaccountToken, phoneNumber }) {
  const subaccountTokenEnc = encryptSecret(subaccountToken);
  if (mode === "pg") {
    const { rows } = await pool.query(
      `UPDATE users SET twilio_status = 'active', twilio_error = '',
         twilio_subaccount_sid = $1, twilio_subaccount_token_enc = $2, twilio_phone_number = $3
       WHERE id = $4 RETURNING *`,
      [subaccountSid, subaccountTokenEnc, phoneNumber, id],
    );
    return rowToUser(rows[0]);
  }
  const users = readFileUsers();
  const u = users.find((x) => x.id === id);
  if (!u) return null;
  u.twilio = { status: "active", error: "", subaccountSid, subaccountTokenEnc, phoneNumber };
  writeFileUsers(users);
  return u;
}

export async function deleteUser(id) {
  if (mode === "pg") {
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    return;
  }
  writeFileUsers(readFileUsers().filter((u) => u.id !== id));
}

export async function countAdmins() {
  if (mode === "pg") {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin'");
    return rows[0].n;
  }
  return readFileUsers().filter((u) => u.role === "admin").length;
}

// ── first-run admin seed ────────────────────────────────────────────────────
// Ensures there is always at least one approved admin who can approve everyone
// else. Override the credentials with ADMIN_EMAIL / ADMIN_PASSWORD env vars.
async function ensureAdmin() {
  const email = normEmail(process.env.ADMIN_EMAIL || "admin@callforge.app");
  const password = process.env.ADMIN_PASSWORD || "changeme123";
  const usingDefaults = !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD;

  const existing = await getUserByEmail(email);
  if (existing) {
    // Make sure the configured admin stays an approved admin.
    if (existing.role !== "admin" || existing.status !== "approved") {
      await setUserRole(existing.id, "admin");
      await setUserStatus(existing.id, "approved");
    }
    return;
  }
  // Don't create a second default admin if some admin already exists.
  if (usingDefaults && (await countAdmins()) > 0) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await createUser({ email, passwordHash, role: "admin", status: "approved" });
  console.log("──────────────────────────────────────────────────────────");
  console.log(`✅ Admin account ready → ${email}`);
  if (usingDefaults) {
    console.log(`   Default password: ${password}`);
    console.log("   ⚠ Change it: set ADMIN_EMAIL and ADMIN_PASSWORD env vars and redeploy.");
  }
  console.log("──────────────────────────────────────────────────────────");
}
