// CallForge — durable store for bulk-calling campaigns + per-number attempts.
//
// Same two-backend pattern as store.js (users):
//   • Postgres  — when DATABASE_URL is set. Durable; survives redeploys, so a
//                 campaign keeps running across restarts. Use this in production.
//   • JSON file — zero-config fallback (server/data/campaigns.json + attempts).
//                 Fine for local dev; wiped on redeploy on hosts like Render.
//
// We persist campaign CONFIG and per-number ATTEMPTS, but NEVER the call
// credentials (OpenAI / Twilio keys). Those are kept in memory only (secrets
// Map below), exactly like calls.json strips secrets. On a server restart,
// campaigns reload from the DB and resume using the SERVER-ENV keys; if a
// campaign relied on browser-supplied keys, it auto-pauses until they're
// re-supplied (the scheduler will surface the missing-keys error).
//
// A campaign:
//   { id, userId, name, status:'running'|'paused'|'completed'|'canceled',
//     defaultTz, defaultWindows:[{start,end}], days:[7 bools|null],
//     countryOverrides:{ '<callingCode>': { tz, windows, days } },
//     retryDelayMinutes, maxAttempts, concurrency,
//     callConfig:{ businessInfo, scriptText, targetLang, aiInstructions, voice, accent },
//     createdAt, updatedAt }
//
// An attempt (one per phone number):
//   { id, campaignId, clientId, name, contact, phone, industry, countryCode,
//     status:'queued'|'calling'|'done'|'canceled',
//     disposition: null|'attended'|'missed'|'declined'|'do-not-call'|'invalid',
//     attempts, nextRunAt, lastCallId, lastSummary, lastMeetingTime, history:[],
//     createdAt, updatedAt }

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAMPAIGNS_FILE = path.join(__dirname, "data", "campaigns.json");
const ATTEMPTS_FILE = path.join(__dirname, "data", "attempts.json");
const DATABASE_URL = process.env.DATABASE_URL || "";

let pool = null;
let mode = "file";

// In-memory call credentials per campaign (never persisted). Lost on restart;
// campaigns then fall back to server-env keys.
const secrets = new Map();

const newId = () => crypto.randomUUID();
const nowISO = () => new Date().toISOString();

// ── file helpers ────────────────────────────────────────────────────────────
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
}
function writeJson(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
}

// ── init ────────────────────────────────────────────────────────────────────
export async function init() {
  if (DATABASE_URL) {
    const { default: pg } = await import("pg");
    pool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
    });
    // Store nested config as JSONB blobs to avoid wide schemas / migrations.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'running',
        data        JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS call_attempts (
        id           TEXT PRIMARY KEY,
        campaign_id  TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'queued',
        next_run_at  TIMESTAMPTZ,
        data         JSONB NOT NULL,
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_attempts_campaign ON call_attempts (campaign_id)`);
    mode = "pg";
    console.log("ℹ  Campaign store: Postgres (durable).");
  } else {
    mode = "file";
    if (!fs.existsSync(CAMPAIGNS_FILE)) writeJson(CAMPAIGNS_FILE, []);
    if (!fs.existsSync(ATTEMPTS_FILE)) writeJson(ATTEMPTS_FILE, []);
    console.log("⚠  Campaign store: local JSON file (NOT durable on hosts like Render). Set DATABASE_URL for production.");
  }
}

// ── secrets (in-memory only) ────────────────────────────────────────────────
export function setSecrets(campaignId, creds) { secrets.set(campaignId, creds || {}); }
export function getSecrets(campaignId) { return secrets.get(campaignId) || {}; }

// ── campaign CRUD ───────────────────────────────────────────────────────────
export async function createCampaign(c) {
  const campaign = {
    id: newId(),
    status: "running",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    ...c,
  };
  if (mode === "pg") {
    await pool.query(
      "INSERT INTO campaigns (id, user_id, status, data, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [campaign.id, campaign.userId, campaign.status, campaign, campaign.createdAt, campaign.updatedAt],
    );
  } else {
    const rows = readJson(CAMPAIGNS_FILE);
    rows.push(campaign);
    writeJson(CAMPAIGNS_FILE, rows);
  }
  return campaign;
}

export async function getCampaign(id) {
  if (mode === "pg") {
    const { rows } = await pool.query("SELECT data FROM campaigns WHERE id = $1", [id]);
    return rows[0]?.data || null;
  }
  return readJson(CAMPAIGNS_FILE).find((c) => c.id === id) || null;
}

export async function listCampaigns(userId) {
  if (mode === "pg") {
    const { rows } = await pool.query("SELECT data FROM campaigns WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    return rows.map((r) => r.data);
  }
  return readJson(CAMPAIGNS_FILE)
    .filter((c) => c.userId === userId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// Campaigns the scheduler should look at (running or paused — paused are skipped
// inside the loop but still loaded so a resume takes effect immediately).
export async function listActiveCampaigns() {
  if (mode === "pg") {
    const { rows } = await pool.query("SELECT data FROM campaigns WHERE status IN ('running','paused')");
    return rows.map((r) => r.data);
  }
  return readJson(CAMPAIGNS_FILE).filter((c) => c.status === "running" || c.status === "paused");
}

export async function updateCampaign(id, patch) {
  if (mode === "pg") {
    const cur = await getCampaign(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, updatedAt: nowISO() };
    await pool.query("UPDATE campaigns SET status = $1, data = $2, updated_at = now() WHERE id = $3", [next.status, next, id]);
    return next;
  }
  const rows = readJson(CAMPAIGNS_FILE);
  const i = rows.findIndex((c) => c.id === id);
  if (i === -1) return null;
  rows[i] = { ...rows[i], ...patch, updatedAt: nowISO() };
  writeJson(CAMPAIGNS_FILE, rows);
  return rows[i];
}

// ── attempt CRUD ────────────────────────────────────────────────────────────
export async function createAttempts(list) {
  const attempts = list.map((a) => ({
    id: newId(),
    status: "queued",
    disposition: null,
    attempts: 0,
    lastCallId: null,
    lastSummary: "",
    lastMeetingTime: "",
    history: [],
    createdAt: nowISO(),
    updatedAt: nowISO(),
    ...a,
  }));
  if (mode === "pg") {
    for (const a of attempts) {
      await pool.query(
        "INSERT INTO call_attempts (id, campaign_id, status, next_run_at, data, updated_at) VALUES ($1,$2,$3,$4,$5,now())",
        [a.id, a.campaignId, a.status, a.nextRunAt || null, a],
      );
    }
  } else {
    const rows = readJson(ATTEMPTS_FILE);
    rows.push(...attempts);
    writeJson(ATTEMPTS_FILE, rows);
  }
  return attempts;
}

export async function listAttempts(campaignId) {
  if (mode === "pg") {
    const { rows } = await pool.query("SELECT data FROM call_attempts WHERE campaign_id = $1 ORDER BY created_at", [campaignId]);
    return rows.map((r) => r.data);
  }
  return readJson(ATTEMPTS_FILE).filter((a) => a.campaignId === campaignId);
}

export async function getAttempt(id) {
  if (mode === "pg") {
    const { rows } = await pool.query("SELECT data FROM call_attempts WHERE id = $1", [id]);
    return rows[0]?.data || null;
  }
  return readJson(ATTEMPTS_FILE).find((a) => a.id === id) || null;
}

export async function updateAttempt(id, patch) {
  if (mode === "pg") {
    const cur = await getAttempt(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, updatedAt: nowISO() };
    await pool.query("UPDATE call_attempts SET status = $1, next_run_at = $2, data = $3, updated_at = now() WHERE id = $4",
      [next.status, next.nextRunAt || null, next, id]);
    return next;
  }
  const rows = readJson(ATTEMPTS_FILE);
  const i = rows.findIndex((a) => a.id === id);
  if (i === -1) return null;
  rows[i] = { ...rows[i], ...patch, updatedAt: nowISO() };
  writeJson(ATTEMPTS_FILE, rows);
  return rows[i];
}

// Bulk status change for one campaign's still-active attempts (used by cancel).
export async function cancelAttempts(campaignId) {
  if (mode === "pg") {
    await pool.query(
      "UPDATE call_attempts SET status = 'canceled', updated_at = now() WHERE campaign_id = $1 AND status IN ('queued','calling')",
      [campaignId],
    );
    // Keep the JSONB status field in sync.
    const { rows } = await pool.query("SELECT id, data FROM call_attempts WHERE campaign_id = $1", [campaignId]);
    for (const r of rows) {
      if (r.data.status === "queued" || r.data.status === "calling") {
        const next = { ...r.data, status: "canceled", updatedAt: nowISO() };
        await pool.query("UPDATE call_attempts SET data = $1 WHERE id = $2", [next, r.id]);
      }
    }
    return;
  }
  const rows = readJson(ATTEMPTS_FILE);
  for (const a of rows) {
    if (a.campaignId === campaignId && (a.status === "queued" || a.status === "calling")) {
      a.status = "canceled";
      a.updatedAt = nowISO();
    }
  }
  writeJson(ATTEMPTS_FILE, rows);
}
