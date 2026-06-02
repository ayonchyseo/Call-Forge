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
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-4o-mini-realtime-preview";
const ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL || "gpt-4o-mini";
const VOICE = process.env.OPENAI_VOICE || "alloy";
// Hard cap on call length so a stuck/forgotten call can't run up charges.
const CALL_MAX_SECONDS = Number(process.env.CALL_MAX_SECONDS || 300);

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
    "About your business:",
    businessInfo || "(no business info provided)",
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
    "Goals: (1) introduce yourself and ask if it's a good time; (2) understand their need and present the offer briefly; (3) if interested, propose a specific day/time for a 15-20 min meeting and confirm it; (4) if not interested, thank them and end politely.",
    `Always speak ${lang}. Never fabricate facts. Respect requests not to be called. Open the call by greeting them first.`,
  ].join("\n");
}

// ── post-call analysis with a cheap model ───────────────────────────────────
async function analyzeTranscript(transcript, apiKey) {
  const key = apiKey || OPENAI_API_KEY;
  const fallback = { isLead: false, interestLevel: "none", meetingRequested: false, meetingTime: "", summary: "" };
  if (!transcript.trim() || !key) return fallback;
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
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
    analyzeTranscript(text, call.openaiKey).then((analysis) => {
      call.result = { ...analysis, transcript: text, endedReason: reason || "" };
      saveCalls();
    });
  } else {
    call.result = { ...cannedOutcome(reason), transcript: "", endedReason: reason || "" };
  }
  saveCalls();
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false })); // Twilio status callbacks are form-encoded

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
app.post("/api/generate-script", async (req, res) => {
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
    `Business / offer (may be non-English):\n${String(businessInfo).slice(0, 4000)}`,
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
app.post("/api/ai-call", async (req, res) => {
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
  // Terminal states where the bridge may never have produced a transcript.
  if (["completed", "busy", "no-answer", "failed", "canceled"].includes(status)) {
    finalizeCall(call, `twilio-${status}`);
  }
  saveCalls();
});

app.get("/api/ai-call/:callId", (req, res) => {
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
  let openaiReady = false;
  const pending = []; // audio that arrives before OpenAI is ready

  function finalize(reason) {
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
    finalizeCall(callId && calls[callId], reason);
  }

  function connectOpenAI() {
    const call = calls[callId];
    const key = call?.openaiKey || OPENAI_API_KEY;
    openaiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`, {
      headers: { Authorization: `Bearer ${key}`, "OpenAI-Beta": "realtime=v1" },
    });

    openaiWs.on("open", () => {
      openaiWs.send(JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions: call?.instructions || "You are a polite sales agent.",
          voice: VOICE,
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          input_audio_transcription: { model: "whisper-1" },
          turn_detection: { type: "server_vad", silence_duration_ms: 600 },
        },
      }));
      // greet first
      openaiWs.send(JSON.stringify({ type: "response.create" }));
      openaiReady = true;
      while (pending.length) openaiWs.send(pending.shift());
    });

    openaiWs.on("message", (raw) => {
      let evt;
      try { evt = JSON.parse(raw.toString()); } catch { return; }
      const call = calls[callId];
      if (evt.type === "response.audio.delta" && evt.delta && streamSid) {
        twilioWs.send(JSON.stringify({ event: "media", streamSid, media: { payload: evt.delta } }));
      } else if (evt.type === "input_audio_buffer.speech_started" && streamSid) {
        // caller barged in — stop our current playback and cancel the in-flight response
        twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
        if (openaiWs?.readyState === WebSocket.OPEN) openaiWs.send(JSON.stringify({ type: "response.cancel" }));
      } else if (evt.type === "conversation.item.input_audio_transcription.completed" && call) {
        const t = (evt.transcript || "").trim();
        if (t) call.transcript.push({ role: "prospect", text: t });
        saveCalls();
      } else if (evt.type === "response.audio_transcript.done" && call) {
        const t = (evt.transcript || "").trim();
        if (t) call.transcript.push({ role: "agent", text: t });
        saveCalls();
      } else if (evt.type === "error") {
        console.warn("OpenAI realtime error:", evt.error?.message || evt.error);
      }
    });

    openaiWs.on("error", () => finalize("openai-error"));
    openaiWs.on("close", () => { openaiReady = false; });
  }

  twilioWs.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.event === "start") {
      streamSid = msg.start.streamSid;
      callId = msg.start.customParameters?.callId;
      if (callId && calls[callId]) connectOpenAI();
    } else if (msg.event === "media") {
      const append = JSON.stringify({ type: "input_audio_buffer.append", audio: msg.media.payload });
      if (openaiReady && openaiWs?.readyState === WebSocket.OPEN) openaiWs.send(append);
      else pending.push(append);
    } else if (msg.event === "stop") {
      finalize("twilio-stop");
    }
  });

  twilioWs.on("close", () => finalize("twilio-close"));
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

server.listen(PORT, () => {
  console.log(`CallForge AI-call backend (Twilio + OpenAI) on http://localhost:${PORT}`);
  if (fs.existsSync(DIST_DIR)) console.log(`Serving built UI from ${DIST_DIR}`);
  if (!PUBLIC_URL) console.log("⚠  PUBLIC_URL not set — required for live AI calls (run `ngrok http 8787` and set it in server/.env).");
  console.log("ℹ  OpenAI/Twilio keys can be entered in the app's Settings, or set here in server/.env.");
});
