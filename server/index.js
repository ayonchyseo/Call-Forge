// CallForge — AI auto-calling backend (Twilio + OpenAI only)
//
// How it works (no third-party voice platform — no Vapi/Bland/Retell):
//   1. POST /api/ai-call          → Twilio places an outbound call from YOUR
//                                    Twilio number and streams the call audio to
//                                    this server over a websocket.
//   2. /media-stream (websocket)  → bridges Twilio's audio <-> OpenAI's Realtime
//                                    API. OpenAI does speech-to-speech in one
//                                    connection, in the target language.
//   3. POST /api/twilio-status    → Twilio tells us when the call rings / is
//                                    answered / ends (so we never wait forever).
//   4. When the call ends, a cheap gpt-4o-mini call reads the transcript and
//      extracts the lead status + meeting time + summary.
//   5. GET /api/ai-call/:callId   → the frontend polls this for live status,
//                                    partial transcript, and the final outcome.
//
// Keys can come from the UI (per request) OR from server/.env. Per-request keys
// take priority, so the app can be fully configured from the browser. PUBLIC_URL
// is the one thing that must be set on the server (it's the backend's own URL).

import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./store.js";
import { setupAuth, requireAuth } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "calls.json");
const DIST_DIR = path.join(__dirname, "..", "dist");

const PORT = process.env.PORT || 8787;
// PUBLIC_URL is the backend's own public https URL (Twilio streams call audio to it).
// On Render it's provided automatically as RENDER_EXTERNAL_URL, so no manual setup needed.
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/+$/, "");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;  // your Twilio number, E.164 e.g. +15551234567
// GA Realtime model candidates. If the first isn't accessible on the account/key,
// the bridge automatically falls back to the next one DURING the call. Override
// with OPENAI_REALTIME_MODEL to pin a single model.
// Order matters: the FASTEST + cheapest model goes first. gpt-realtime-mini has
// noticeably lower time-to-first-audio (and lower cost) than the full
// gpt-realtime — and on a live phone call that response latency is exactly what
// the prospect notices. The full model and the older preview stay as automatic
// fallbacks if the mini isn't accessible on the account/key.
const REALTIME_MODELS = process.env.OPENAI_REALTIME_MODEL
  ? [process.env.OPENAI_REALTIME_MODEL]
  : ["gpt-realtime-mini", "gpt-realtime", "gpt-4o-realtime-preview"];
const ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL || "gpt-4o-mini";
const VOICE = process.env.OPENAI_VOICE || "alloy";
// Hard cap on call length so a stuck/forgotten call can't run up charges.
const CALL_MAX_SECONDS = Number(process.env.CALL_MAX_SECONDS || 300);

// ── Turn-detection (VAD) tuning ─────────────────────────────────────────────
// These two knobs control the two things people notice most on a live call:
// how fast the agent replies, and whether it gets cut off mid-sentence.
//   • VAD_THRESHOLD  — speech-onset sensitivity (0..1). HIGHER = LESS sensitive.
//     The old 0.5 was too trigger-happy on a phone line: echo of the agent's own
//     voice and background noise falsely fired "barge-in", which wipes the audio
//     OpenAI had already queued on Twilio (OpenAI generates faster than realtime,
//     so a lot is buffered). The result was the agent going silent partway through
//     a reply while the FULL reply still showed in the transcript. 0.6 keeps real
//     interruptions working while stopping those false cut-offs.
//   • VAD_SILENCE_MS — how long the prospect must pause before the agent speaks.
//     Lower = snappier responses. 600ms felt sluggish; 500ms is clearly faster
//     without clipping the prospect mid-thought.
//   • VAD_PREFIX_MS  — audio retained just before detected speech (unchanged).
//
// Parsed through envNum so a mistyped/out-of-range value can't reach the wire:
// Number("fast") is NaN, and JSON.stringify turns NaN into null inside
// session.update — which the GA Realtime API rejects, taking the WHOLE audio
// config (µ-law format + VAD) down with it and silently leaving the call on the
// wrong pcm16 default. A bad operator knob must never break the call, so on
// anything invalid we warn and fall back to the documented default.
function envNum(name, def, { min, max } = {}) {
  const raw = process.env[name];
  if (raw == null || raw === "") return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || (min != null && n < min) || (max != null && n > max)) {
    console.warn(`⚠  Ignoring ${name}="${raw}" (must be a number${min != null ? ` ≥ ${min}` : ""}${max != null ? ` ≤ ${max}` : ""}) — using default ${def}.`);
    return def;
  }
  return n;
}
const VAD_THRESHOLD = envNum("VAD_THRESHOLD", 0.6, { min: 0, max: 1 });
const VAD_SILENCE_MS = envNum("VAD_SILENCE_MS", 500, { min: 0 });
const VAD_PREFIX_MS = envNum("VAD_PREFIX_MS", 300, { min: 0 });

// ── tiny JSON file store (fine for a PoC) ───────────────────────────────────
function loadCalls() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { return {}; }
}
// Persist calls WITHOUT secrets — user-supplied keys stay in memory only.
function saveCalls() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const sanitized = {};
    for (const [id, c] of Object.entries(calls)) {
      const { openaiKey, acct, ...rest } = c;
      sanitized[id] = rest;
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(sanitized, null, 2));
  } catch (err) {
    console.warn("Could not persist calls.json:", err.message);
  }
}
const calls = loadCalls();

// ── the agent's instructions for one client ─────────────────────────────────
function buildInstructions({ name, contact, industry, businessInfo, scriptText, targetLang, aiInstructions }) {
  const lang = (targetLang || "English").trim() || "English";
  return [
    `You are a professional cold-calling sales agent on an outbound phone call. Speak natural, warm, conversational ${lang}. Be polite and concise, never robotic or pushy. Keep your turns short like a real phone conversation.`,
    "",
    "KNOWLEDGE BASE — this is everything you know about the business you represent. Use it to pitch, and to answer ANY question the prospect asks (services, pricing, process, company details, policies). If an answer is not in here, say you'll have someone follow up — do NOT make facts up:",
    businessInfo || "(no knowledge base provided)",
    aiInstructions && aiInstructions.trim()
      ? `\nExtra instructions from the business owner — follow these carefully:\n${aiInstructions.trim()}`
      : "",
    "",
    `You are calling: ${name || "a prospect"}${contact ? ` (contact: ${contact})` : ""}${industry ? `, industry: ${industry}` : ""}.`,
    "",
    `Use the script below as a loose guide for structure and intent — do NOT read it verbatim, and if any of it is not in ${lang} just convey the intent naturally in ${lang}:`,
    "----------------",
    scriptText || "(no script provided — improvise a polite intro, a short pitch, and a meeting request)",
    "----------------",
    "",
    "Goals: (1) introduce yourself and ask if it's a good time; (2) understand their need and present the offer briefly; (3) answer any question they raise accurately, using the knowledge base above; (4) if interested, propose a specific day/time for a 15-20 min meeting and confirm it; (5) if not interested, thank them and end politely.",
    `Always speak ${lang}. Never fabricate facts. Respect requests not to be called. Open the call by greeting them first.`,
  ].join("\n");
}

// ── post-call analysis with a cheap model ───────────────────────────────────
async function analyzeTranscript(transcript, apiKey) {
  const key = apiKey || OPENAI_API_KEY;
  const fallback = { isLead: false, interestLevel: "none", meetingRequested: false, meetingTime: "", summary: "" };
  if (!transcript.trim() || !key) return fallback;
  // Hard 25-second cap so a slow/unavailable API never hangs the result
  // indefinitely — the frontend spins until result is set, so a hung
  // analysis means the UI spinner never clears.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 25000);
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: abort.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Extract structured outcome from a sales cold-call transcript. Reply ONLY with JSON: {\"isLead\":bool, \"interestLevel\":\"high|medium|low|none\", \"meetingRequested\":bool, \"meetingTime\":string, \"summary\":string}." },
          { role: "user", content: transcript.slice(0, 12000) },
        ],
      }),
    });
    const data = await r.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    return { ...fallback, ...parsed };
  } catch {
    return { ...fallback, summary: "(analysis failed)" };
  } finally {
    clearTimeout(timer);
  }
}

// Canned outcome for calls that ended without a real conversation.
function cannedOutcome(reason) {
  const map = {
    "twilio-no-answer": "No answer.",
    "twilio-busy": "Line was busy.",
    "twilio-failed": "Call failed to connect.",
    "twilio-canceled": "Call was canceled.",
    "max-duration": "Call ended automatically (reached the maximum allowed length).",
    "openai-error": "Call ended early due to an AI connection error.",
  };
  return {
    isLead: false,
    interestLevel: "none",
    meetingRequested: false,
    meetingTime: "",
    summary: map[reason] || "Call ended with no conversation.",
  };
}

// Hang up an in-flight Twilio call (stops charges on stuck/expired calls).
async function hangupTwilio(call) {
  const sid = call?.acct?.sid, token = call?.acct?.token;
  if (!call?.twilioSid || !sid || !token) return;
  try {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${call.twilioSid}.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      },
      body: new URLSearchParams({ Status: "completed" }),
    });
  } catch { /* best effort */ }
}

// Mark a call finished, run analysis (or a canned outcome), and persist.
// Idempotent: safe to call from the websocket, the status callback, or a timer.
function finalizeCall(call, reason) {
  if (!call || call.status !== "in-progress") return;
  call.status = "completed";
  call.endedAt = new Date().toISOString();
  call.endedReason = reason || "";
  const text = call.transcript.map((t) => `${t.role}: ${t.text}`.trim()).filter(Boolean).join("\n");
  if (text.trim()) {
    analyzeTranscript(text, call.openaiKey)
      .then((analysis) => {
        call.result = { ...analysis, transcript: text, endedReason: reason || "" };
        saveCalls();
      })
      // A rejection here used to be unhandled and could take the whole server
      // down (Node >=22 exits on unhandled rejections). Never let analysis crash the process.
      .catch((err) => {
        console.error("analyzeTranscript failed:", err?.message || err);
        call.result = { ...cannedOutcome(reason), transcript: text, endedReason: reason || "" };
        saveCalls();
      });
  } else {
    const base = cannedOutcome(reason);
    if (call.lastError) base.summary = `AI error: ${call.lastError}`;
    call.result = { ...base, transcript: "", endedReason: call.lastError || reason || "" };
  }
  saveCalls();
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false })); // Twilio status callbacks are form-encoded

// Auth + admin-approval routes (/api/auth/*, /api/admin/*).
setupAuth(app);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    // Server-side config is optional now (keys can come from the UI). PUBLIC_URL
    // is the one value only the server can provide for live calls.
    publicUrl: Boolean(PUBLIC_URL),
    hasServerOpenAI: Boolean(OPENAI_API_KEY),
    hasServerTwilio: Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER),
  });
});

// Generate a cold-call script in the target language from business info written
// in ANY language. Key comes from the request (UI) or falls back to server env.
app.post("/api/generate-script", requireAuth, async (req, res) => {
  const { name, contact, industry, businessInfo, openaiKey, targetLang, aiInstructions } = req.body || {};
  const key = openaiKey || OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: "No OpenAI key. Add it in Settings, or set OPENAI_API_KEY on the server." });
  if (!businessInfo || !String(businessInfo).trim()) return res.status(400).json({ error: "businessInfo is required." });
  const lang = (targetLang || "English").trim() || "English";

  const sys = [
    "You are an expert B2B cold-calling script writer.",
    "The business description and prospect details may be written in ANY language (e.g. Bangla, Spanish, Arabic, Hindi).",
    `ALWAYS write the final script in natural, professional ${lang} — translate any input that is in a different language.`,
    aiInstructions && aiInstructions.trim() ? `Honor these extra instructions from the business owner: ${aiInstructions.trim()}.` : "",
    "Return ONLY a JSON object with these exact string keys:",
    '"OPENING", "HOOK", "PITCH", "OBJECTION HANDLING", "MEETING CLOSE", "CLOSING".',
    "Each value is the spoken text for that phase — warm, concise, not robotic. Use { } placeholders for details the caller fills in live, e.g. { your name }.",
  ].filter(Boolean).join(" ");
  const user = [
    `Knowledge base (may be non-English):\n${String(businessInfo).slice(0, 8000)}`,
    "",
    `Prospect: ${name || "(company)"}${contact ? `, contact ${contact}` : ""}${industry ? `, industry ${industry}` : ""}.`,
  ].join("\n");

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "OpenAI rejected the request" });
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    const ORDER = ["OPENING", "HOOK", "PITCH", "OBJECTION HANDLING", "MEETING CLOSE", "CLOSING"];
    const script = {};
    for (const k of ORDER) if (typeof parsed[k] === "string" && parsed[k].trim()) script[k] = parsed[k];
    for (const [k, v] of Object.entries(parsed)) if (!script[k] && typeof v === "string" && v.trim()) script[k] = v;
    if (!Object.keys(script).length) return res.status(502).json({ error: "Model returned an empty script." });
    res.json({ script });
  } catch (err) {
    res.status(502).json({ error: `Script generation failed: ${err.message}` });
  }
});

// Start an outbound AI call via Twilio.
app.post("/api/ai-call", requireAuth, async (req, res) => {
  const {
    clientId, name, contact, phone, industry, businessInfo, scriptText,
    openaiKey, twilioSid, twilioToken, twilioFrom, targetLang, aiInstructions,
  } = req.body || {};

  // Resolve credentials: request (UI) first, then server env.
  const oaKey = openaiKey || OPENAI_API_KEY;
  const twSid = twilioSid || TWILIO_ACCOUNT_SID;
  const twToken = twilioToken || TWILIO_AUTH_TOKEN;
  const twFrom = twilioFrom || TWILIO_FROM_NUMBER;

  const missing = [];
  if (!oaKey) missing.push("OpenAI key");
  if (!twSid || !twToken) missing.push("Twilio Account SID + Auth Token");
  if (!twFrom) missing.push("Twilio From number");
  if (!PUBLIC_URL) missing.push("PUBLIC_URL (set on the backend server)");
  if (missing.length) {
    return res.status(500).json({ error: `Missing: ${missing.join(", ")}. Add your keys in Settings; PUBLIC_URL is configured on the backend.` });
  }

  const number = String(phone || "").replace(/[^+\d]/g, "");
  if (!number || number.length < 8 || !number.startsWith("+")) {
    return res.status(400).json({ error: "Invalid phone number — use full international format, e.g. +14155550142." });
  }

  const callId = crypto.randomUUID();
  calls[callId] = {
    callId, clientId, name, phone,
    status: "in-progress", twilioStatus: "queued", startedAt: new Date().toISOString(),
    openaiKey: oaKey,                       // in-memory only (never persisted/exposed)
    acct: { sid: twSid, token: twToken },   // in-memory only
    instructions: buildInstructions({ name, contact, industry, businessInfo, scriptText, targetLang, aiInstructions }),
    transcript: [], result: null,
  };
  saveCalls();

  const wssUrl = PUBLIC_URL.replace(/^http/, "ws") + "/media-stream";
  const statusUrl = `${PUBLIC_URL}/api/twilio-status?callId=${callId}`;
  const twiml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Connect><Stream url="${wssUrl}">` +
    `<Parameter name="callId" value="${callId}"/>` +
    `</Stream></Connect></Response>`;

  try {
    const body = new URLSearchParams({
      To: number,
      From: twFrom,
      Twiml: twiml,
      StatusCallback: statusUrl,
      StatusCallbackMethod: "POST",
    });
    ["initiated", "ringing", "answered", "completed"].forEach((e) => body.append("StatusCallbackEvent", e));

    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twSid}/Calls.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${twSid}:${twToken}`).toString("base64"),
      },
      body,
    });
    const data = await r.json();
    if (!r.ok) {
      calls[callId].status = "completed";
      calls[callId].result = { ...cannedOutcome("twilio-failed"), transcript: "", endedReason: data?.message || "twilio-rejected" };
      saveCalls();
      return res.status(r.status).json({ error: data?.message || "Twilio rejected the call", details: data });
    }
    calls[callId].twilioSid = data.sid;
    saveCalls();
    console.log(`[call ${callId}] Twilio call created (sid=${data.sid}); dialing ${number} from ${twFrom}`);

    // Safety net: force-finish + hang up if the call runs past the cap.
    setTimeout(() => {
      const c = calls[callId];
      if (c && c.status === "in-progress") {
        finalizeCall(c, "max-duration");
        hangupTwilio(c);
      }
    }, CALL_MAX_SECONDS * 1000).unref?.();

    res.json({ callId, status: "in-progress" });
  } catch (err) {
    calls[callId].status = "completed";
    calls[callId].result = { ...cannedOutcome("twilio-failed"), transcript: "", endedReason: err.message };
    saveCalls();
    res.status(502).json({ error: `Could not reach Twilio: ${err.message}` });
  }
});

// Twilio posts call lifecycle here (ringing / answered / completed / no-answer / busy / failed).
app.post("/api/twilio-status", (req, res) => {
  res.sendStatus(200); // ack fast; Twilio retries on non-2xx
  const call = calls[req.query.callId];
  if (!call) return;
  const status = req.body.CallStatus || "";
  call.twilioStatus = status;
  console.log(`[call ${req.query.callId}] Twilio status: ${status}`);
  // Terminal states where the bridge may never have produced a transcript.
  if (["completed", "busy", "no-answer", "failed", "canceled"].includes(status)) {
    finalizeCall(call, `twilio-${status}`);
  }
  saveCalls();
});

app.get("/api/ai-call/:callId", requireAuth, (req, res) => {
  const call = calls[req.params.callId];
  if (!call) return res.status(404).json({ error: "Unknown call id" });
  // Never echo secrets back to the client.
  const { instructions, openaiKey, acct, ...safe } = call;
  res.json(safe);
});

// ── websocket bridge: Twilio media stream  <->  OpenAI Realtime ─────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/media-stream" });

wss.on("connection", (twilioWs) => {
  let callId = null;
  let streamSid = null;
  let openaiWs = null;
  let openaiReady = false;   // true once the session is configured (safe to stream audio)
  let greeted = false;
  let responding = false;    // an assistant response is currently being generated
  let framesToTwilio = 0;
  let modelIdx = 0;          // index into REALTIME_MODELS (auto-fallback)
  const seen = new Set();    // log each OpenAI event type once
  const pending = [];        // caller audio that arrives before the session is ready

  const log = (...a) => console.log(`[call ${callId || "?"}]`, ...a);
  const recordError = (msg) => { const c = callId && calls[callId]; if (c) c.lastError = msg; };

  function finalize(reason) {
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
    finalizeCall(callId && calls[callId], reason);
  }

  function startConversation(ws) {
    if (greeted || ws.readyState !== WebSocket.OPEN) return;
    greeted = true;
    openaiReady = true;
    log(`session ready → greeting; flushing ${pending.length} queued audio frames`);
    ws.send(JSON.stringify({
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text: "The call just connected. Greet the person warmly and begin the conversation now." }] },
    }));
    ws.send(JSON.stringify({ type: "response.create" }));
    while (pending.length && ws.readyState === WebSocket.OPEN) ws.send(pending.shift());
  }

  // Try the next model if the current one isn't usable; returns true if it retried.
  function tryNextModel(why) {
    if (greeted || modelIdx >= REALTIME_MODELS.length - 1) return false;
    log(`model "${REALTIME_MODELS[modelIdx]}" unusable (${why}) → trying next`);
    modelIdx++;
    connectOpenAI();
    return true;
  }

  function connectOpenAI() {
    const call = calls[callId];
    const key = call?.openaiKey || OPENAI_API_KEY;
    if (!key) { log("✗ no OpenAI key available"); recordError("No OpenAI key provided."); return finalize("openai-error"); }
    const model = REALTIME_MODELS[modelIdx];
    log(`connecting to OpenAI Realtime (GA) — model ${modelIdx + 1}/${REALTIME_MODELS.length}: ${model}`);
    // GA Realtime API: /v1/realtime, NO "OpenAI-Beta" header (that's the retired beta).
    const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    openaiWs = ws;

    ws.on("open", () => {
      log("OpenAI ws open → sending GA session.update");
      // GA session shape: audio.input/output with object formats; pcmu = G.711 µ-law (Twilio).
      // (Verified against live call logs — this is the correct current GA format.)
      ws.send(JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          instructions: call?.instructions || "You are a polite sales agent.",
          output_modalities: ["audio"],
          // Audio formats are set in the nested audio.input/output blocks below
          // (pcmu = G.711 µ-law, what Twilio streams). Do NOT add a top-level
          // output_audio_format here — that is the retired beta field, and the GA
          // API rejects the ENTIRE session.update on any unknown param. That
          // rejection silently leaves the INPUT format at its pcm16 default, so
          // OpenAI misreads Twilio's µ-law audio and the agent never responds
          // to the prospect after the opening greeting.
          audio: {
            input: {
              format: { type: "audio/pcmu" },
              turn_detection: { type: "server_vad", threshold: VAD_THRESHOLD, prefix_padding_ms: VAD_PREFIX_MS, silence_duration_ms: VAD_SILENCE_MS },
              transcription: { model: "whisper-1" },
            },
            output: {
              format: { type: "audio/pcmu" },
              voice: VOICE,
            },
          },
        },
      }));
      // Greet even if we somehow don't see session.updated (but after config has a moment to apply).
      setTimeout(() => { if (ws === openaiWs && !greeted && ws.readyState === WebSocket.OPEN) { log("no session.updated after 3s — greeting anyway"); startConversation(ws); } }, 3000);
    });

    ws.on("message", (raw) => {
      let evt;
      try { evt = JSON.parse(raw.toString()); } catch { return; }
      const call = calls[callId];
      if (!seen.has(evt.type)) { seen.add(evt.type); log("OpenAI event:", evt.type); }

      switch (evt.type) {
        case "session.updated":
          startConversation(ws);
          break;
        case "response.created":
          responding = true;
          break;
        case "response.done":
          responding = false;
          break;
        // GA emits response.output_audio.delta; accept the old name too just in case.
        case "response.output_audio.delta":
        case "response.audio.delta":
          // Guard readyState: the prospect may hang up (Twilio socket closes) while
          // OpenAI is still streaming audio. send() on a closed socket throws, and an
          // unguarded throw here crashed the whole server.
          if (evt.delta && streamSid && twilioWs.readyState === WebSocket.OPEN) {
            if (++framesToTwilio === 1) log("▶ first audio frame → Twilio (agent is speaking)");
            twilioWs.send(JSON.stringify({ event: "media", streamSid, media: { payload: evt.delta } }));
          }
          break;
        case "input_audio_buffer.speech_started":
          // Barge-in: the prospect started talking. Flush the agent audio already
          // queued on Twilio so playback stops instantly, and cancel the in-flight
          // OpenAI response so the agent stops generating more.
          if (streamSid && twilioWs.readyState === WebSocket.OPEN) twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
          if (responding && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "response.cancel" }));
            // A response can only be cancelled once. Clearing the flag here stops
            // repeated speech_started events from firing duplicate cancels, which
            // produced a stream of "response_cancel_not_active" errors and made the
            // agent talk over the prospect.
            responding = false;
          }
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (call) { const t = (evt.transcript || "").trim(); if (t) { call.transcript.push({ role: "prospect", text: t }); saveCalls(); log("prospect:", t); } }
          break;
        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done":
          if (call) { const t = (evt.transcript || "").trim(); if (t) { call.transcript.push({ role: "agent", text: t }); saveCalls(); log("agent:", t); } }
          break;
        case "error":
          // "response_cancel_not_active" is a benign race: we asked to cancel a
          // response that already finished on its own. Ignore it so it doesn't spam
          // the logs or get mis-reported as the call's failure reason.
          if (evt.error?.code === "response_cancel_not_active") break;
          // Log + record but don't cycle here: real connection failures (bad model,
          // no access, retired protocol) surface as a ws "close", handled below.
          log("✗ OpenAI error event:", JSON.stringify(evt.error || evt));
          recordError((evt.error && (evt.error.message || evt.error.code)) || "OpenAI error");
          break;
      }
    });

    ws.on("error", (err) => { log("✗ OpenAI ws error:", err?.message || err); });
    ws.on("close", (code, reasonBuf) => {
      const reason = (reasonBuf && reasonBuf.toString()) || "";
      openaiReady = false;
      if (ws !== openaiWs) return; // a superseded (retried) socket closing — ignore
      log(`OpenAI ws closed (code=${code} reason="${reason}"); audio frames sent to Twilio: ${framesToTwilio}`);
      if (greeted) return;
      if (tryNextModel(`closed code=${code}`)) return;
      // All models exhausted and we never got audio — surface it and end the dead-air call.
      recordError(`Realtime connection failed: ${reason || `code ${code}`}. Check OpenAI Realtime access / OPENAI_REALTIME_MODEL.`);
      finalize("openai-error");
      hangupTwilio(calls[callId]);
    });
  }

  twilioWs.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    switch (msg.event) {
      case "connected":
        break;
      case "start":
        if (!msg.start) { log("✗ malformed 'start' event — missing start object"); break; }
        streamSid = msg.start.streamSid;
        callId = msg.start.customParameters?.callId;
        log("Twilio stream started; format:", JSON.stringify(msg.start.mediaFormat || {}));
        if (!callId) log("✗ no callId in Twilio customParameters — cannot map this stream to a call");
        else if (!calls[callId]) log("✗ unknown callId from Twilio:", callId);
        else connectOpenAI();
        break;
      case "media": {
        if (!msg.media) break;
        const append = JSON.stringify({ type: "input_audio_buffer.append", audio: msg.media.payload });
        if (openaiReady && openaiWs?.readyState === WebSocket.OPEN) openaiWs.send(append);
        else pending.push(append);
        break;
      }
      case "stop":
        log("Twilio stream stopped");
        finalize("twilio-stop");
        break;
    }
  });

  twilioWs.on("close", () => { log("Twilio ws closed"); finalize("twilio-close"); });
});

// ── serve the built frontend (single-command production) ────────────────────
// After `npm run build`, the whole app is available from this server on :PORT.
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/media-stream")) return next();
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

// Express error handler — a thrown (synchronous) route error becomes a JSON 500
// instead of a hung request. Must be registered after all routes.
app.use((err, _req, res, _next) => {
  console.error("✗ Request error:", err?.stack || err?.message || err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Server error — please try again." });
});

// ── last-resort safety nets ─────────────────────────────────────────────────
// A single bad request, a dropped websocket, or a rejected background promise
// must NEVER take the whole server down. Node >=22 EXITS the process on an
// unhandled rejection/exception by default — and on an ephemeral host (e.g.
// Render free) that restart wipes the user store, which is exactly what made
// accounts vanish and logins fail right after placing a call. Log and stay up.
process.on("unhandledRejection", (reason) => {
  console.error("⚠ Unhandled promise rejection (server kept alive):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠ Uncaught exception (server kept alive):", err?.stack || err);
});

// Initialize the user store (DB/file + admin seed) before accepting traffic.
store.init().catch((err) => {
  console.error("✗ User store failed to initialize:", err.message);
  console.error("   Auth/login will not work. Check DATABASE_URL, or unset it to use the file store.");
});

server.listen(PORT, () => {
  console.log(`CallForge AI-call backend (Twilio + OpenAI) on http://localhost:${PORT}`);
  if (fs.existsSync(DIST_DIR)) console.log(`Serving built UI from ${DIST_DIR}`);
  if (!PUBLIC_URL) console.log("⚠  PUBLIC_URL not set — required for live AI calls (run `ngrok http 8787` and set it in server/.env).");
  console.log("ℹ  OpenAI/Twilio keys can be entered in the app's Settings, or set here in server/.env.");
});
