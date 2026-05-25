// CallForge — AI auto-calling backend (proof-of-concept)
//
// What this does:
//   1. POST /api/ai-call   → starts an outbound AI phone call via Vapi.
//                            The AI speaks Bangla, follows the generated
//                            cold-call script, and tries to book a meeting.
//   2. POST /api/vapi-webhook → Vapi calls this when the call ends. We pull
//                            the transcript + structured lead/meeting data and
//                            store it so the frontend can read the outcome.
//   3. GET  /api/ai-call/:callId → frontend polls this for the result.
//
// Vapi handles the hard parts (telephony + Bangla speech-to-text + text-to-
// speech + the LLM loop) so this PoC stays small. Free trial credits are
// enough to test a few calls. See server/.env.example for setup.

import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "calls.json");

const PORT = process.env.PORT || 8787;
const VAPI_API_KEY = process.env.VAPI_API_KEY;        // private key (server side)
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;
const PUBLIC_URL = process.env.PUBLIC_URL;             // public https url for the webhook
const LLM_PROVIDER = process.env.VAPI_LLM_PROVIDER || "anthropic";
const LLM_MODEL = process.env.VAPI_LLM_MODEL || "claude-3-5-sonnet-20241022";
const VOICE_PROVIDER = process.env.VAPI_VOICE_PROVIDER || "azure";
const VOICE_ID = process.env.VAPI_VOICE_ID || "bn-BD-NabanitaNeural";
const STT_PROVIDER = process.env.VAPI_STT_PROVIDER || "azure";
const STT_LANGUAGE = process.env.VAPI_STT_LANGUAGE || "bn-BD";

// ── tiny JSON file store (fine for a PoC) ───────────────────────────────────
function loadCalls() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}
function saveCalls(calls) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(calls, null, 2));
}

const calls = loadCalls();

// ── build the AI assistant for one client ───────────────────────────────────
function buildSystemPrompt({ name, contact, industry, businessInfo, scriptText }) {
  return [
    "তুমি একজন বাংলায় কথা বলা professional cold-calling sales agent। সম্পূর্ণ কথোপকথন বাংলায় (প্রয়োজনে English term মিশিয়ে) করবে — natural, ভদ্র এবং সংক্ষিপ্ত।",
    "",
    "তোমার business সম্পর্কে তথ্য:",
    businessInfo || "(no business info provided)",
    "",
    `তুমি কল করছো: ${name}${contact ? ` (যোগাযোগ: ${contact})` : ""}${industry ? `, খাত: ${industry}` : ""}`,
    "",
    "নিচের script-টা guideline হিসেবে অনুসরণ করো (হুবহু পড়বে না, স্বাভাবিকভাবে কথা বলবে):",
    "----------------",
    scriptText || "(no script provided — improvise a polite intro, pitch, and meeting request)",
    "----------------",
    "",
    "লক্ষ্য:",
    "1. ভদ্রভাবে introduce করো এবং কথা বলার অনুমতি নাও।",
    "2. তাদের প্রয়োজন বোঝো এবং offer-টা সংক্ষেপে পেশ করো।",
    "3. আগ্রহী হলে একটি ১৫-২০ মিনিটের meeting এর জন্য একটি নির্দিষ্ট দিন ও সময় propose করো এবং confirm করো।",
    "4. আগ্রহী না হলে ভদ্রভাবে ধন্যবাদ দিয়ে কল শেষ করো।",
    "কখনো অভদ্র হবে না, কখনো মিথ্যা তথ্য দেবে না। কল ছোট রাখো।",
  ].join("\n");
}

function buildAssistant(client) {
  return {
    name: `CallForge — ${client.name}`,
    firstMessage:
      "আসসালামু আলাইকুম, ভালো আছেন? আমি একটু কথা বলতে চাইছিলাম, আপনার কি এখন ২ মিনিট সময় হবে?",
    model: {
      provider: LLM_PROVIDER,
      model: LLM_MODEL,
      messages: [{ role: "system", content: buildSystemPrompt(client) }],
      temperature: 0.6,
    },
    voice: { provider: VOICE_PROVIDER, voiceId: VOICE_ID },
    transcriber: { provider: STT_PROVIDER, language: STT_LANGUAGE },
    // Ask Vapi to summarise + extract structured lead/meeting data after the call.
    analysisPlan: {
      summaryPlan: { enabled: true },
      structuredDataPlan: {
        enabled: true,
        schema: {
          type: "object",
          properties: {
            isLead: { type: "boolean", description: "ব্যক্তি আগ্রহী এবং একটি potential lead কিনা" },
            interestLevel: { type: "string", enum: ["high", "medium", "low", "none"] },
            meetingRequested: { type: "boolean", description: "একটি meeting এ রাজি হয়েছে কিনা" },
            meetingTime: { type: "string", description: "confirm হওয়া meeting এর দিন/সময়, না হলে খালি" },
            summary: { type: "string", description: "কলের সংক্ষিপ্ত বাংলা সারাংশ" },
          },
        },
      },
    },
  };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, configured: Boolean(VAPI_API_KEY && VAPI_PHONE_NUMBER_ID) });
});

// Start an outbound AI call.
app.post("/api/ai-call", async (req, res) => {
  if (!VAPI_API_KEY || !VAPI_PHONE_NUMBER_ID) {
    return res.status(500).json({ error: "Server missing VAPI_API_KEY / VAPI_PHONE_NUMBER_ID. See server/.env.example." });
  }
  const { clientId, name, contact, phone, industry, businessInfo, scriptText } = req.body || {};
  const number = String(phone || "").replace(/[^+\d]/g, "");
  if (!number || number.length < 6) {
    return res.status(400).json({ error: "Invalid phone number." });
  }

  const payload = {
    phoneNumberId: VAPI_PHONE_NUMBER_ID,
    customer: { number },
    assistant: buildAssistant({ name, contact, industry, businessInfo, scriptText }),
  };
  if (PUBLIC_URL) payload.assistant.server = { url: `${PUBLIC_URL}/api/vapi-webhook` };

  try {
    const r = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${VAPI_API_KEY}` },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.message || "Vapi rejected the call request", details: data });
    }
    calls[data.id] = {
      callId: data.id,
      clientId,
      name,
      phone,
      status: "in-progress",
      startedAt: new Date().toISOString(),
      result: null,
    };
    saveCalls(calls);
    res.json({ callId: data.id, status: "in-progress" });
  } catch (err) {
    res.status(502).json({ error: `Could not reach Vapi: ${err.message}` });
  }
});

// Vapi posts call lifecycle events here. We only care about the end-of-call report.
app.post("/api/vapi-webhook", (req, res) => {
  const msg = req.body?.message;
  if (msg?.type === "end-of-call-report") {
    const callId = msg.call?.id;
    const analysis = msg.analysis || {};
    const structured = analysis.structuredData || {};
    if (callId && calls[callId]) {
      calls[callId].status = "completed";
      calls[callId].endedAt = new Date().toISOString();
      calls[callId].result = {
        isLead: Boolean(structured.isLead),
        interestLevel: structured.interestLevel || "none",
        meetingRequested: Boolean(structured.meetingRequested),
        meetingTime: structured.meetingTime || "",
        summary: structured.summary || analysis.summary || "",
        transcript: msg.transcript || "",
        endedReason: msg.endedReason || "",
      };
      saveCalls(calls);
    }
  }
  res.json({ received: true });
});

// Frontend polls this for the outcome of a call.
app.get("/api/ai-call/:callId", (req, res) => {
  const call = calls[req.params.callId];
  if (!call) return res.status(404).json({ error: "Unknown call id" });
  res.json(call);
});

app.listen(PORT, () => {
  console.log(`CallForge AI-call backend on http://localhost:${PORT}`);
  if (!VAPI_API_KEY) console.log("⚠  VAPI_API_KEY not set — see server/.env.example");
});
