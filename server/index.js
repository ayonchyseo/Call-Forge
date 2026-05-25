// CallForge — AI auto-calling backend (Twilio + OpenAI only)
//
// How it works (no third-party voice platform):
//   1. POST /api/ai-call          → Twilio places an outbound call from YOUR
//                                    Twilio number and streams the call audio to
//                                    this server over a websocket.
//   2. /media-stream (websocket)  → bridges Twilio's audio <-> OpenAI's Realtime
//                                    API. OpenAI does speech-to-speech (listen +
//                                    think + talk) in one connection, in English.
//   3. When the call ends, a cheap gpt-4o-mini call reads the transcript and
//      extracts the lead status + meeting time + summary.
//   4. GET /api/ai-call/:callId   → the frontend polls this for the outcome.
//
// Only Twilio + OpenAI are used. Lowest-cost defaults: gpt-4o-mini-realtime for
// the call, gpt-4o-mini for the post-call analysis. See server/.env.example.

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

const PORT = process.env.PORT || 8787;
// On Render the public URL is provided automatically; otherwise set it yourself.
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;  // your Twilio number, E.164 e.g. +15551234567
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-4o-mini-realtime-preview";
const ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL || "gpt-4o-mini";
const VOICE = process.env.OPENAI_VOICE || "alloy";

// ── tiny JSON file store (fine for a PoC) ───────────────────────────────────
function loadCalls() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { return {}; }
}
function saveCalls() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(calls, null, 2));
}
const calls = loadCalls();

// ── the agent's instructions for one client ─────────────────────────────────
function buildInstructions({ name, contact, industry, businessInfo, scriptText }) {
  return [
    "You are a professional cold-calling sales agent on an outbound phone call. Speak natural, warm, conversational English. Be polite and concise, never robotic or pushy. Keep your turns short like a real phone conversation.",
    "",
    "About your business:",
    businessInfo || "(no business info provided)",
    "",
    `You are calling: ${name || "a prospect"}${contact ? ` (contact: ${contact})` : ""}${industry ? `, industry: ${industry}` : ""}.`,
    "",
    "Use the script below as a loose guide for structure and intent — do NOT read it verbatim, and if any of it is not in English just convey the intent naturally in English:",
    "----------------",
    scriptText || "(no script provided — improvise a polite intro, a short pitch, and a meeting request)",
    "----------------",
    "",
    "Goals: (1) introduce yourself and ask if it's a good time; (2) understand their need and present the offer briefly; (3) if interested, propose a specific day/time for a 15-20 min meeting and confirm it; (4) if not interested, thank them and end politely.",
    "Never fabricate facts. Respect requests not to be called. Open the call by greeting them first.",
  ].join("\n");
}

// ── post-call analysis with a cheap model ───────────────────────────────────
async function analyzeTranscript(transcript) {
  const fallback = { isLead: false, interestLevel: "none", meetingRequested: false, meetingTime: "", summary: "" };
  if (!transcript.trim() || !OPENAI_API_KEY) return fallback;
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
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

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(OPENAI_API_KEY && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER && PUBLIC_URL),
    missing: [
      !OPENAI_API_KEY && "OPENAI_API_KEY",
      !TWILIO_ACCOUNT_SID && "TWILIO_ACCOUNT_SID",
      !TWILIO_AUTH_TOKEN && "TWILIO_AUTH_TOKEN",
      !TWILIO_FROM_NUMBER && "TWILIO_FROM_NUMBER",
      !PUBLIC_URL && "PUBLIC_URL",
    ].filter(Boolean),
  });
});

// Start an outbound AI call via Twilio.
app.post("/api/ai-call", async (req, res) => {
  const missing = [];
  if (!OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) missing.push("TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN");
  if (!TWILIO_FROM_NUMBER) missing.push("TWILIO_FROM_NUMBER");
  if (!PUBLIC_URL) missing.push("PUBLIC_URL");
  if (missing.length) return res.status(500).json({ error: `Server is missing: ${missing.join(", ")}. See server/.env.example.` });

  const { clientId, name, contact, phone, industry, businessInfo, scriptText } = req.body || {};
  const number = String(phone || "").replace(/[^+\d]/g, "");
  if (!number || number.length < 8) return res.status(400).json({ error: "Invalid phone number (use full international format, e.g. +1...)." });

  const callId = crypto.randomUUID();
  calls[callId] = {
    callId, clientId, name, phone,
    status: "in-progress", startedAt: new Date().toISOString(),
    instructions: buildInstructions({ name, contact, industry, businessInfo, scriptText }),
    transcript: [], result: null,
  };
  saveCalls();

  const wssUrl = PUBLIC_URL.replace(/^http/, "ws") + "/media-stream";
  const twiml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Connect><Stream url="${wssUrl}">` +
    `<Parameter name="callId" value="${callId}"/>` +
    `</Stream></Connect></Response>`;

  try {
    const body = new URLSearchParams({ To: number, From: TWILIO_FROM_NUMBER, Twiml: twiml });
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
      },
      body,
    });
    const data = await r.json();
    if (!r.ok) {
      calls[callId].status = "failed";
      saveCalls();
      return res.status(r.status).json({ error: data?.message || "Twilio rejected the call", details: data });
    }
    calls[callId].twilioSid = data.sid;
    saveCalls();
    res.json({ callId, status: "in-progress" });
  } catch (err) {
    res.status(502).json({ error: `Could not reach Twilio: ${err.message}` });
  }
});

app.get("/api/ai-call/:callId", (req, res) => {
  const call = calls[req.params.callId];
  if (!call) return res.status(404).json({ error: "Unknown call id" });
  const { instructions, ...safe } = call;
  res.json(safe);
});

// ── serve the built dashboard from the same server (one URL for everything) ──
const distDir = path.join(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
}

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
    const call = callId && calls[callId];
    if (call && call.status === "in-progress") {
      call.status = "completed";
      call.endedAt = new Date().toISOString();
      const text = call.transcript.map((t) => `${t.role}: ${t.text}`).join("\n");
      analyzeTranscript(text).then((analysis) => {
        call.result = { ...analysis, transcript: text, endedReason: reason || "" };
        saveCalls();
      });
    }
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
  }

  function connectOpenAI() {
    const call = calls[callId];
    openaiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "OpenAI-Beta": "realtime=v1" },
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
        // caller barged in — stop our current playback
        twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
      } else if (evt.type === "conversation.item.input_audio_transcription.completed" && call) {
        call.transcript.push({ role: "prospect", text: (evt.transcript || "").trim() });
      } else if (evt.type === "response.audio_transcript.done" && call) {
        call.transcript.push({ role: "agent", text: (evt.transcript || "").trim() });
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

server.listen(PORT, () => {
  console.log(`CallForge AI-call backend (Twilio + OpenAI) on http://localhost:${PORT}`);
  const need = ["OPENAI_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "PUBLIC_URL"]
    .filter((k) => !process.env[k]);
  if (need.length) console.log(`⚠  Not configured yet — set in server/.env: ${need.join(", ")}`);
});
