import { useState, useRef, useEffect } from "react";

const ACCENT = "#00FF94";
const BG = "#0A0A0F";
const CARD = "#12121A";
const BORDER = "#1E1E2E";
const MUTED = "#4A4A6A";
const TEXT = "#E8E8F0";
const WARN = "#FFB800";
const DANGER = "#FF4444";
const INFO = "#7B8FFF";

const DEFAULT_BUSINESS = `Business: SoftPulse Agency
Service: Digital Marketing & Web Development
Offer: Free website audit + 1 month of social media management, on us
Target: Small and mid-sized businesses`;

const SAMPLE_CLIENTS = [
  { id: 1, name: "Summit Retail Co", contact: "Sarah Mitchell", phone: "+14155550142", industry: "Retail", notes: "", status: "new", script: null },
  { id: 2, name: "Orbit Logistics", contact: "James Carter", phone: "+442079460958", industry: "Logistics", notes: "", status: "new", script: null },
  { id: 3, name: "BrightCare Clinics", contact: "Dr. Emily Nguyen", phone: "+61255501234", industry: "Healthcare", notes: "", status: "new", script: null },
];

// ── Industry-specific script content ──────────────────────────────────────────
const INDUSTRY_MAP = {
  telecom: {
    pain: "rising customer acquisition costs and intense market competition",
    benefit: "win new customers and retain the ones you already have",
    objection: "We already have our own marketing team",
    objReply: "Absolutely — we're not here to replace your team, we're here to amplify their efforts. The results are usually much stronger when we work alongside an in-house team.",
  },
  logistics: {
    pain: "delivery efficiency and real-time tracking challenges",
    benefit: "cut delivery costs and improve customer satisfaction",
    objection: "Our budget is tight right now",
    objReply: "I completely understand — that's exactly why we start with a free audit, at no cost, so you can see where the opportunities are before committing anything.",
  },
  technology: {
    pain: "building a strong digital presence and generating qualified leads",
    benefit: "increase online visibility and bring in qualified leads",
    objection: "We already do digital marketing",
    objReply: "That's great — then we can review your current strategy and show you exactly where there's room to push your ROI even higher.",
  },
  healthcare: {
    pain: "patient acquisition and appointment management",
    benefit: "attract new patients and raise your appointment rate",
    objection: "Digital marketing doesn't really work in healthcare",
    objReply: "Actually, healthcare is one of the fastest-growing sectors for digital marketing — our healthcare clients see around 40% more appointments on average.",
  },
  education: {
    pain: "declining student enrollment and weak brand awareness",
    benefit: "boost enrollment and build a stronger brand",
    objection: "Students find us on their own",
    objReply: "That's true today — but competition is growing fast. With the right digital strategy you can reach far more of the right students.",
  },
  finance: {
    pain: "building client trust and generating new leads",
    benefit: "win new clients and strengthen your brand credibility",
    objection: "There are compliance concerns in the finance sector",
    objReply: "We're fully aware of finance-sector compliance — every strategy we build is designed to stay within the rules.",
  },
  retail: {
    pain: "declining foot traffic and the push to grow online sales",
    benefit: "grow your customer base and increase repeat purchases",
    objection: "Our business is seasonal",
    objReply: "We have specific strategies for seasonal businesses — maximizing your peak season and keeping revenue steady through the off-season.",
  },
  manufacturing: {
    pain: "B2B client acquisition and expanding into new markets",
    benefit: "reach new buyers and expand into new markets",
    objection: "We grow mostly through word of mouth",
    objReply: "Word of mouth is excellent — a strong digital presence simply amplifies it, and makes it far easier for serious buyers to find you.",
  },
  realestate: {
    pain: "listing visibility and finding qualified buyers",
    benefit: "sell or rent properties faster and reach premium buyers",
    objection: "We're already listed on the major portals",
    objReply: "Portals are a good start, but targeted social media and SEO let you reach far more qualified buyers directly.",
  },
  food: {
    pain: "customer loyalty and growing online orders",
    benefit: "keep regulars coming back and grow delivery orders",
    objection: "We're already on the big delivery apps",
    objReply: "Those apps are useful, but your own digital presence means no commissions and a direct relationship with your customers.",
  },
};

function getIndustryData(industry) {
  if (!industry) return null;
  const key = industry.toLowerCase().replace(/[\s\-_]/g, "");
  for (const [k, v] of Object.entries(INDUSTRY_MAP)) {
    if (key.includes(k) || k.includes(key.substring(0, Math.min(key.length, 5)))) return v;
  }
  return null;
}

function parseBusinessInfo(text) {
  const info = { name: "our company", service: "our service", offer: "a special offer", target: "small and mid-sized businesses" };
  text.split("\n").forEach((line) => {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) return;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();
    if (!val) return;
    if (key.includes("business") || key.includes("company") || key.includes("name")) info.name = val;
    else if (key.includes("service") || key.includes("product")) info.service = val;
    else if (key.includes("offer")) info.offer = val;
    else if (key.includes("target")) info.target = val;
  });
  return info;
}

// ── Template-based Bangla script generator (no API required) ─────────────────
function generateScript(client, businessInfoText) {
  const biz = parseBusinessInfo(businessInfoText);
  const ind = getIndustryData(client.industry) || {
    pain: "business growth and market expansion",
    benefit: "win new clients and grow revenue",
    objection: "I don't have time right now",
    objReply: "Of course — could we find a convenient time next week for a quick chat instead?",
  };
  const contact = client.contact || "there";
  const company = client.name;
  const industry = client.industry || "business";

  return {
    OPENING:
`Hi, may I speak with ${contact}?

(once connected)
Hi ${contact}, this is { your name } from ${biz.name}. I know you weren't expecting my call, so I'll keep it quick — do you have a couple of minutes? I think there's something here that could really help ${company}.`,

    HOOK:
`A lot of ${industry} companies like ${company} run into the same challenge: ${ind.pain}.

We've helped businesses in exactly that situation, and they've seen some real results.

Is that something you're working on at the moment as well?`,

    PITCH:
`We provide ${biz.service}, which helps you ${ind.benefit}.

For ${company} specifically, we're offering:
  ✦ ${biz.offer}

It's a risk-free way to start — take a look first, then decide. Most of our clients see a noticeable difference within 3 to 6 months.`,

    "OBJECTION HANDLING":
`Objection & Response Guide:

❶ If they say: "${ind.objection}"
   → ${ind.objReply}

❷ If they say: "We don't have the budget"
   → "I understand completely. That's why we keep flexible payment options — and with ${biz.offer}, there's a risk-free way to get started."

❸ If they say: "Call me back later"
   → "Of course — when works best for you? Would sometime next Tuesday or Wednesday suit you?"

❹ If they say: "I'm not sure, let me think about it"
   → "That's totally fair. A short meeting where you can see all the details usually makes the decision much easier — it only takes 15 minutes."`,

    "MEETING CLOSE":
`${contact}, it's been great talking with you.

Could we set up a short 15–20 minute meeting at a time that works for you? I'll put together a plan tailored to ${company}'s specific situation.

Would later this week or early next week work better for you?
(Phone, Zoom, or in person — whatever's easiest for you.)`,

    CLOSING:
`Thank you so much for your time.

Once we confirm the meeting, I'll send a reminder for { date & time of the meeting }.

My direct number is { your phone number } — feel free to call anytime if anything comes up.

Have a great rest of your day!

─────────────────────────────
💡 Note: fill in the parts marked with { } during the call.`,
  };
}

// ── Flatten a generated script object into plain text for the AI agent ────────
function scriptToText(script) {
  if (!script) return "";
  return Object.entries(script)
    .map(([section, text]) => `## ${section}\n${text}`)
    .join("\n\n");
}

// Where the backend lives. In dev → local server; in a production build → same
// origin (so a single deployed service serving this UI just works). Override with
// VITE_API_URL at build time or the Backend URL field in Settings.
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:8787" : "");

const DEFAULT_SETTINGS = {
  targetLang: "English",
  aiInstructions: "",
  openaiKey: "",
  twilioSid: "",
  twilioToken: "",
  twilioFrom: "",
  backendUrl: "",
};

const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Arabic", "Hindi", "Bangla", "Chinese", "Japanese"];

// Short code for the target language, shown in the header badge.
function langShort(lang) {
  const map = { english: "EN", spanish: "ES", french: "FR", german: "DE", arabic: "AR", hindi: "HI", bangla: "BN", bengali: "BN", portuguese: "PT", chinese: "ZH", japanese: "JA" };
  const l = (lang || "English").trim();
  return map[l.toLowerCase()] || l.slice(0, 2).toUpperCase();
}

// ── Browser-direct OpenAI script generation (works with NO backend) ───────────
// Uses the user's own key (from Settings), calling api.openai.com directly, so
// real AI scripts work even on static hosting like Vercel.
async function openaiGenerateScript({ client, businessInfo, openaiKey, targetLang, aiInstructions }) {
  const lang = (targetLang || "English").trim() || "English";
  const sys = [
    "You are an expert B2B cold-calling script writer.",
    "The business description and prospect details may be written in ANY language (e.g. Bangla, Spanish, Arabic, Hindi).",
    `ALWAYS write the final script in natural, professional ${lang} — translate any input that is in a different language.`,
    aiInstructions && aiInstructions.trim() ? `Honor these extra instructions from the business owner: ${aiInstructions.trim()}.` : "",
    'Return ONLY a JSON object with these exact string keys: "OPENING", "HOOK", "PITCH", "OBJECTION HANDLING", "MEETING CLOSE", "CLOSING".',
    "Each value is the spoken text for that phase — warm, concise, not robotic. Use { } placeholders for details the caller fills in live, e.g. { your name }.",
  ].filter(Boolean).join(" ");
  const user = `Business / offer (may be non-English):\n${String(businessInfo).slice(0, 4000)}\n\nProspect: ${client.name || "(company)"}${client.contact ? `, contact ${client.contact}` : ""}${client.industry ? `, industry ${client.industry}` : ""}.`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
    }),
  });
  if (!r.ok) {
    let msg = "OpenAI request failed";
    try { msg = (await r.json())?.error?.message || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const data = await r.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  const ORDER = ["OPENING", "HOOK", "PITCH", "OBJECTION HANDLING", "MEETING CLOSE", "CLOSING"];
  const script = {};
  for (const k of ORDER) if (typeof parsed[k] === "string" && parsed[k].trim()) script[k] = parsed[k];
  for (const [k, v] of Object.entries(parsed)) if (!script[k] && typeof v === "string" && v.trim()) script[k] = v;
  if (!Object.keys(script).length) throw new Error("Model returned an empty script");
  return script;
}

// ── Improved CSV parser (handles quoted fields with commas) ───────────────────
function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (line[i] === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += line[i];
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { clients: [], error: "CSV must have at least a header row and one data row." };
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/"/g, ""));
  const clients = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const obj = { id: Date.now() + i, status: "new", notes: "", script: null };
    headers.forEach((h, idx) => {
      if (h.includes("name") || h.includes("company")) obj.name = vals[idx] || "";
      else if (h.includes("contact") || h.includes("person")) obj.contact = vals[idx] || "";
      else if (h.includes("phone") || h.includes("number") || h.includes("mobile")) obj.phone = vals[idx] || "";
      else if (h.includes("industry") || h.includes("sector")) obj.industry = vals[idx] || "";
    });
    if (!obj.name) obj.name = vals[0] || `Client ${i}`;
    if (!obj.phone) obj.phone = vals.find((v) => /\d{7,}/.test(v)) || "N/A";
    clients.push(obj);
  }
  return { clients, error: null };
}

// ── LocalStorage helpers ──────────────────────────────────────────────────────
function loadState(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function saveState(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota exceeded — ignore */ }
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function statusColor(status) {
  return status === "converted" ? ACCENT : status === "follow-up" ? WARN : status === "not-interested" ? DANGER : MUTED;
}

function statusLabel(status) {
  return status === "converted" ? "Lead" : status === "follow-up" ? "Follow-up" : status === "not-interested" ? "Declined" : "New";
}

function aiStatusLabel(s) {
  const map = { queued: "Queued…", initiated: "Connecting…", ringing: "Ringing…", "in-progress": "On the call…", answered: "On the call…" };
  return map[s] || (s || "Starting…");
}

// ── Toast component ───────────────────────────────────────────────────────────
function ToastList({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 1000, display: "flex", flexDirection: "column", gap: "8px" }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            padding: "10px 16px",
            borderRadius: "6px",
            fontSize: "12px",
            fontFamily: "'DM Mono', monospace",
            background: t.type === "error" ? `${DANGER}22` : t.type === "warn" ? `${WARN}22` : `${ACCENT}22`,
            border: `1px solid ${t.type === "error" ? DANGER : t.type === "warn" ? WARN : ACCENT}66`,
            color: t.type === "error" ? DANGER : t.type === "warn" ? WARN : ACCENT,
            maxWidth: "300px",
            animation: "slideIn 0.2s ease",
          }}
        >
          {t.type === "error" ? "✗ " : t.type === "warn" ? "⚠ " : "✓ "}{t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Modal scaffolding ─────────────────────────────────────────────────────────
const modalInp = {
  width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: "6px",
  color: TEXT, fontFamily: "inherit", fontSize: "12px", padding: "9px 11px", outline: "none", boxSizing: "border-box",
};

function Overlay({ title, onClose, children, footer }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000A", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", width: "100%", maxWidth: "520px", maxHeight: "86vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: "13px", color: ACCENT, letterSpacing: "0.1em" }}>{title}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, fontSize: "18px", cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: "18px 20px", overflowY: "auto" }}>{children}</div>
        {footer && <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: "10px", justifyContent: "flex-end", flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: "15px" }}>
      <div style={{ fontSize: "10px", letterSpacing: "0.12em", color: MUTED, textTransform: "uppercase", marginBottom: "6px" }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: "10px", color: MUTED, marginTop: "5px", lineHeight: 1.6 }}>{hint}</div>}
    </div>
  );
}

function SettingsModal({ settings, onSave, onClose }) {
  const [d, setD] = useState(settings);
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  const btn = (bg, color, border) => ({ padding: "9px 18px", background: bg, border: `1px solid ${border}`, borderRadius: "6px", color, fontFamily: "inherit", fontSize: "12px", cursor: "pointer" });
  return (
    <Overlay
      title="⚙ SETTINGS"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} style={btn("transparent", MUTED, BORDER)}>Cancel</button>
        <button onClick={() => { onSave(d); onClose(); }} style={btn(`${ACCENT}22`, ACCENT, `${ACCENT}66`)}>Save</button>
      </>}
    >
      <Field label="Script & call language" hint="Business info can be in any language — scripts and the AI agent will use this language.">
        <select style={modalInp} value={d.targetLang} onChange={(e) => set("targetLang", e.target.value)}>
          {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </Field>

      <Field label="AI call instructions / knowledge" hint="Anything the AI agent should know or follow on calls — your offer details, tone, rules, facts, do's & don'ts. The agent obeys this.">
        <textarea style={{ ...modalInp, height: "100px", resize: "vertical", lineHeight: 1.6 }} value={d.aiInstructions}
          onChange={(e) => set("aiInstructions", e.target.value)}
          placeholder={"e.g. Always mention our 14-day free trial. Never promise specific pricing. If asked who we are, say we're an authorized partner. Keep calls under 3 minutes."} />
      </Field>

      <div style={{ margin: "18px 0 12px", padding: "10px 12px", background: `${WARN}11`, border: `1px solid ${WARN}44`, borderRadius: "6px", fontSize: "10px", color: WARN, lineHeight: 1.6 }}>
        ⚠ Keys are stored only in <b>this browser</b> (localStorage) and sent to your backend / OpenAI directly. Use your own keys on a device you trust. Don't use this on a shared computer.
      </div>

      <Field label="OpenAI API key" hint="Enables AI script generation right here in the browser (no backend needed), and powers AI calls. Get one at platform.openai.com/api-keys.">
        <input type="password" style={modalInp} value={d.openaiKey} onChange={(e) => set("openaiKey", e.target.value)} placeholder="sk-..." autoComplete="off" />
      </Field>

      <div style={{ fontSize: "10px", letterSpacing: "0.12em", color: INFO, textTransform: "uppercase", margin: "20px 0 10px", borderTop: `1px solid ${BORDER}`, paddingTop: "16px" }}>
        Twilio — for live AI calls only
      </div>
      <Field label="Twilio Account SID">
        <input style={modalInp} value={d.twilioSid} onChange={(e) => set("twilioSid", e.target.value)} placeholder="AC..." autoComplete="off" />
      </Field>
      <Field label="Twilio Auth Token">
        <input type="password" style={modalInp} value={d.twilioToken} onChange={(e) => set("twilioToken", e.target.value)} placeholder="••••••••" autoComplete="off" />
      </Field>
      <Field label="Twilio From number" hint="Your Twilio voice number in international format.">
        <input style={modalInp} value={d.twilioFrom} onChange={(e) => set("twilioFrom", e.target.value)} placeholder="+15551234567" autoComplete="off" />
      </Field>
      <Field label="Backend URL" hint="Where your CallForge call-backend runs (it needs a public URL Twilio can reach). Required for live AI calls — a static site like Vercel can't place calls on its own. Leave blank to use the default localhost backend in development.">
        <input style={modalInp} value={d.backendUrl} onChange={(e) => set("backendUrl", e.target.value)} placeholder="https://your-backend.onrender.com" autoComplete="off" />
      </Field>

      <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: "18px", paddingTop: "14px" }}>
        <button
          onClick={() => { if (window.confirm("Clear ALL saved data on this device (clients, notes, business info, keys) and reload?")) { localStorage.clear(); window.location.reload(); } }}
          style={{ background: `${DANGER}11`, border: `1px solid ${DANGER}44`, borderRadius: "6px", color: DANGER, padding: "8px 14px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}
        >
          Reset all app data
        </button>
        <div style={{ fontSize: "10px", color: MUTED, marginTop: "6px", lineHeight: 1.6 }}>Clears cached clients/notes/keys from this browser and reloads with fresh sample data.</div>
      </div>
    </Overlay>
  );
}

function HelpModal({ onClose }) {
  const h = { fontSize: "12px", color: ACCENT, letterSpacing: "0.06em", margin: "16px 0 6px" };
  const p = { fontSize: "12px", color: TEXT, lineHeight: 1.7, marginBottom: "6px" };
  const li = { fontSize: "12px", color: MUTED, lineHeight: 1.7, marginLeft: "14px" };
  return (
    <Overlay title="? HOW TO USE" onClose={onClose} footer={<button onClick={onClose} style={{ padding: "9px 18px", background: `${ACCENT}22`, border: `1px solid ${ACCENT}66`, borderRadius: "6px", color: ACCENT, fontFamily: "inherit", fontSize: "12px", cursor: "pointer" }}>Got it</button>}>
      <div style={p}>CallForge helps you cold-call leads: write personalized scripts, dial manually, or let an AI agent place the call for you. You can type your business info in <b>any language</b> — scripts come out in the language you pick in Settings.</div>

      <div style={h}>1 · Describe your business</div>
      <div style={p}>Fill in the <b>Your Business</b> box (left). Any language is fine.</div>

      <div style={h}>2 · Add your leads</div>
      <div style={p}>Upload a CSV (<code>name, phone, contact, industry</code>) or click <b>+ Add</b>. For AI calls, phone numbers must be full international format, e.g. <code>+14155550142</code>.</div>

      <div style={h}>3 · Add your keys (Settings ⚙)</div>
      <div style={li}>• <b>OpenAI key</b> → unlocks AI script generation <i>in your browser</i> (works even on Vercel, no backend).</div>
      <div style={li}>• <b>AI instructions</b> → what the agent should know/say/avoid on calls.</div>
      <div style={li}>• <b>Language</b> → output language for scripts and the AI agent.</div>

      <div style={h}>4 · Generate & call</div>
      <div style={li}>• <b>⚡ Generate Script</b> → personalized script for the selected lead.</div>
      <div style={li}>• <b>📞 Call Now</b> → dials from your phone (tap-to-dial), you read the script.</div>
      <div style={li}>• <b>🤖 AI Call</b> → the AI agent dials and talks (needs the backend, below).</div>

      <div style={h}>5 · Live AI calls need a backend</div>
      <div style={p}>A real phone call requires a small server (Twilio streams the call audio to it). A static site can't do this alone. Deploy <code>server/index.js</code> (Render, Railway, Fly, a VPS…), set <code>PUBLIC_URL</code> to its public https URL, then paste that URL + your Twilio keys into Settings. See the README for steps.</div>

      <div style={{ ...p, marginTop: "14px", color: WARN }}>⚠ AI cold-calling is regulated (TCPA, AI-disclosure, do-not-call). Confirm consent rules and test on your own number first.</div>
    </Overlay>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [clients, setClients] = useState(() => loadState("cf_clients", SAMPLE_CLIENTS));
  const [selected, setSelected] = useState(null);
  const [businessInfo, setBusinessInfo] = useState(() => loadState("cf_business", DEFAULT_BUSINESS));
  const [loading, setLoading] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [calling, setCalling] = useState(false);
  const [callTime, setCallTime] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", contact: "", phone: "", industry: "" });
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [aiCalling, setAiCalling] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiStatus, setAiStatus] = useState("");
  const [aiTranscript, setAiTranscript] = useState([]);
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...loadState("cf_settings", {}) }));
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const fileRef = useRef();
  const timerRef = useRef();
  const aiPollRef = useRef();
  const aiPollCountRef = useRef(0);

  const selectedClient = clients.find((c) => c.id === selected);

  // Persist data
  useEffect(() => { saveState("cf_clients", clients); }, [clients]);
  useEffect(() => { saveState("cf_business", businessInfo); }, [businessInfo]);
  useEffect(() => { saveState("cf_settings", settings); }, [settings]);

  const apiBase = (settings.backendUrl || "").trim().replace(/\/+$/, "") || API_URL;

  // Call timer
  useEffect(() => {
    if (calling) {
      setCallTime(0);
      timerRef.current = setInterval(() => setCallTime((t) => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [calling]);

  // End call / reset AI state when switching clients
  useEffect(() => {
    setCalling(false);
    setNoteInput("");
    setAiCalling(false);
    setAiResult(null);
    setAiStatus("");
    setAiTranscript([]);
    clearInterval(aiPollRef.current);
  }, [selected]);

  useEffect(() => () => clearInterval(aiPollRef.current), []);

  function toast(msg, type = "success") {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.match(/\.(csv|txt)$/i)) {
      toast("Please upload a .csv or .txt file", "error");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { clients: parsed, error } = parseCSV(ev.target.result);
      if (error) toast(error, "error");
      else if (parsed.length === 0) toast("No clients found in the file", "warn");
      else {
        setClients((prev) => [...prev, ...parsed]);
        toast(`${parsed.length} client${parsed.length > 1 ? "s" : ""} imported`);
      }
    };
    reader.onerror = () => toast("Failed to read file", "error");
    reader.readAsText(file);
    e.target.value = "";
  }

  // Build a script for a client. Translates business info (any language) into the
  // chosen language. Order: (1) browser-direct OpenAI with your key — works with
  // NO backend; (2) the backend; (3) the offline template engine.
  async function requestScript(client) {
    const { openaiKey, targetLang, aiInstructions } = settings;
    if (openaiKey && openaiKey.trim()) {
      try {
        const script = await openaiGenerateScript({ client, businessInfo, openaiKey: openaiKey.trim(), targetLang, aiInstructions });
        return { script, source: "ai" };
      } catch { /* fall through to backend / template */ }
    }
    try {
      const res = await fetch(`${apiBase}/api/generate-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: client.name, contact: client.contact, industry: client.industry, businessInfo, targetLang, aiInstructions }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.script && typeof data.script === "object" && Object.keys(data.script).length) {
          return { script: data.script, source: "ai" };
        }
      }
    } catch { /* backend offline → fall back below */ }
    return { script: generateScript(client, businessInfo), source: "template" };
  }

  async function handleGenerateScript() {
    if (!selectedClient || !businessInfo.trim()) {
      toast("Fill in your business info first", "warn");
      return;
    }
    setLoading(true);
    try {
      const { script, source } = await requestScript(selectedClient);
      setClients((prev) => prev.map((c) => (c.id === selected ? { ...c, script } : c)));
      toast(source === "ai" ? `Script generated (${settings.targetLang})` : "Script generated (offline template — add an OpenAI key in Settings for AI)");
    } catch {
      toast("Script generation failed — please try again", "error");
    }
    setLoading(false);
  }

  // ── Start an autonomous AI phone call via the backend ─────────────────────
  async function startAiCall() {
    if (!selectedClient) return;
    let script = selectedClient.script;
    if (!script) {
      script = (await requestScript(selectedClient)).script;
      setClients((prev) => prev.map((c) => (c.id === selected ? { ...c, script } : c)));
    }
    setAiResult(null);
    setAiStatus("queued");
    setAiTranscript([]);
    setAiCalling(true);
    try {
      const res = await fetch(`${apiBase}/api/ai-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          name: selectedClient.name,
          contact: selectedClient.contact,
          phone: selectedClient.phone,
          industry: selectedClient.industry,
          businessInfo,
          scriptText: scriptToText(script),
          // Credentials & options from Settings (backend falls back to its own env).
          openaiKey: settings.openaiKey,
          twilioSid: settings.twilioSid,
          twilioToken: settings.twilioToken,
          twilioFrom: settings.twilioFrom,
          targetLang: settings.targetLang,
          aiInstructions: settings.aiInstructions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start AI call");
      toast("AI call started — agent is dialing");
      pollAiCall(data.callId, selectedClient.id);
    } catch (err) {
      setAiCalling(false);
      const cannotReach = err.message.includes("fetch") || err.message.includes("Failed to fetch") || err.message.includes("NetworkError");
      toast(cannotReach ? "Can't reach the call backend. Live AI calls need a backend server — set its URL in ⚙ Settings (see ? How to use)." : err.message, "error");
    }
  }

  function pollAiCall(callId, clientId) {
    clearInterval(aiPollRef.current);
    aiPollCountRef.current = 0;
    aiPollRef.current = setInterval(async () => {
      // Client-side safety: stop after ~6 min even if the server goes quiet.
      if (++aiPollCountRef.current > 90) {
        clearInterval(aiPollRef.current);
        setAiCalling(false);
        toast("AI call timed out — check the server logs", "warn");
        return;
      }
      try {
        const res = await fetch(`${apiBase}/api/ai-call/${callId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.twilioStatus || data.status) setAiStatus(data.twilioStatus || data.status);
        if (Array.isArray(data.transcript)) setAiTranscript(data.transcript);
        // The server sets `result` on every terminal state (answered, no-answer, busy, failed),
        // so polling on its presence handles success AND failure uniformly.
        if (data.result) {
          clearInterval(aiPollRef.current);
          setAiCalling(false);
          setAiResult(data.result);
          applyAiResult(clientId, data.result);
        }
      } catch { /* keep polling */ }
    }, 4000);
  }

  function applyAiResult(clientId, result) {
    // No real conversation (no answer / busy / failed) → keep them in the pipeline to retry.
    const noConversation = !result.transcript || !result.transcript.trim();
    const status = result.meetingRequested || result.isLead
      ? "converted"
      : noConversation || result.interestLevel === "low"
        ? "follow-up"
        : "not-interested";
    const ts = new Date().toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
    const parts = [`[${ts}] 🤖 AI call: ${result.summary || "(no summary)"}`];
    if (result.meetingTime) parts.push(`Meeting: ${result.meetingTime}`);
    const entry = parts.join(" | ");
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, status, notes: c.notes ? c.notes + "\n" + entry : entry } : c))
    );
    if (result.meetingRequested) toast("Meeting booked by AI ✓");
    else if (result.isLead) toast("Lead captured by AI ✓");
    else if (noConversation) toast(result.summary || "No answer — marked for follow-up", "warn");
    else toast("AI call finished");
  }

  function saveNote() {
    if (!noteInput.trim() || !selected) return;
    const ts = new Date().toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
    const entry = `[${ts}] ${noteInput.trim()}`;
    setClients((prev) =>
      prev.map((c) => (c.id === selected ? { ...c, notes: c.notes ? c.notes + "\n" + entry : entry } : c))
    );
    setNoteInput("");
    toast("Note saved");
  }

  function setStatus(status) {
    if (!selected) return;
    setClients((prev) => prev.map((c) => (c.id === selected ? { ...c, status } : c)));
    toast(`Marked as ${statusLabel(status)}`);
  }

  function addClient() {
    if (!newClient.name.trim()) { toast("Client name is required", "error"); return; }
    const client = {
      id: Date.now(),
      status: "new",
      notes: "",
      script: null,
      name: newClient.name.trim(),
      contact: newClient.contact.trim(),
      phone: newClient.phone.trim() || "N/A",
      industry: newClient.industry.trim(),
    };
    setClients((prev) => [...prev, client]);
    setNewClient({ name: "", contact: "", phone: "", industry: "" });
    setShowAddForm(false);
    toast(`${client.name} added`);
  }

  function deleteClient(id) {
    const c = clients.find((cl) => cl.id === id);
    setClients((prev) => prev.filter((cl) => cl.id !== id));
    if (selected === id) setSelected(null);
    setConfirmDeleteId(null);
    toast(`${c?.name} deleted`);
  }

  function clearAllNotes() {
    if (!selected) return;
    setClients((prev) => prev.map((c) => (c.id === selected ? { ...c, notes: "" } : c)));
    toast("Notes cleared");
  }

  function exportCSV() {
    const headers = ["Name", "Contact", "Phone", "Industry", "Status", "Notes"];
    const rows = clients.map((c) =>
      [
        `"${(c.name || "").replace(/"/g, '""')}"`,
        `"${(c.contact || "").replace(/"/g, '""')}"`,
        `"${(c.phone || "").replace(/"/g, '""')}"`,
        `"${(c.industry || "").replace(/"/g, '""')}"`,
        `"${c.status}"`,
        `"${(c.notes || "").replace(/"/g, '""').replace(/\n/g, " | ")}"`,
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `callforge-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Data exported");
  }

  const filteredClients = clients.filter(
    (c) =>
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.contact?.toLowerCase().includes(search.toLowerCase()) ||
      c.industry?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: clients.length,
    converted: clients.filter((c) => c.status === "converted").length,
    followUp: clients.filter((c) => c.status === "follow-up").length,
    notInterested: clients.filter((c) => c.status === "not-interested").length,
  };

  const script = selectedClient?.script;

  // ── Input style helper ────────────────────────────────────────────────────
  const inp = {
    width: "100%",
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: "6px",
    color: TEXT,
    fontFamily: "inherit",
    fontSize: "12px",
    padding: "8px 10px",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'DM Mono', 'Courier New', monospace", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes slideIn { from { transform: translateX(20px); opacity:0; } to { transform:none; opacity:1; } }
        button:hover { opacity: 0.85; }
        button:active { opacity: 0.7; }
        input::placeholder, textarea::placeholder { color: ${MUTED}; }
      `}</style>

      <ToastList toasts={toasts} />

      {showSettings && <SettingsModal settings={settings} onSave={(s) => { setSettings(s); toast("Settings saved"); }} onClose={() => setShowSettings(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", background: CARD, flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "700", letterSpacing: "0.12em", color: ACCENT }}>⬡ CALLFORGE</div>
        <div style={{ display: "flex", gap: "20px", fontSize: "11px", color: MUTED }}>
          <span>Total <span style={{ color: TEXT }}>{stats.total}</span></span>
          <span>Leads <span style={{ color: ACCENT }}>{stats.converted}</span></span>
          <span>Follow-up <span style={{ color: WARN }}>{stats.followUp}</span></span>
          <span>Declined <span style={{ color: DANGER }}>{stats.notInterested}</span></span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={() => setShowHelp(true)} title="How to use" style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: "5px", color: MUTED, padding: "5px 11px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>
            ? Help
          </button>
          <button onClick={() => setShowSettings(true)} title="Settings & API keys" style={{ background: settings.openaiKey ? `${ACCENT}18` : "transparent", border: `1px solid ${settings.openaiKey ? `${ACCENT}66` : BORDER}`, borderRadius: "5px", color: settings.openaiKey ? ACCENT : MUTED, padding: "5px 11px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>
            ⚙ Settings
          </button>
          <button onClick={exportCSV} style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: "5px", color: MUTED, padding: "5px 12px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>
            ↓ Export
          </button>
          <div title={`Business info in any language → ${settings.targetLang} output`} style={{ background: `${ACCENT}22`, color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: "4px", padding: "4px 10px", fontSize: "10px", letterSpacing: "0.08em" }}>
            ANY LANG → {langShort(settings.targetLang)}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Sidebar ── */}
        <div style={{ width: "300px", flexShrink: 0, borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", overflow: "hidden", background: CARD }}>

          {/* Business info */}
          <div style={{ padding: "16px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: MUTED, textTransform: "uppercase", marginBottom: "8px" }}>Your Business · any language</div>
            <textarea
              style={{ ...inp, height: "110px", resize: "none", lineHeight: "1.7" }}
              value={businessInfo}
              onChange={(e) => setBusinessInfo(e.target.value)}
              placeholder="Business: Company Name&#10;Service: What you offer&#10;Offer: Special deal&#10;Target: Who you call"
            />
          </div>

          {/* Upload & add */}
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: MUTED, textTransform: "uppercase", marginBottom: "10px" }}>Client List</div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <button
                onClick={() => fileRef.current.click()}
                style={{ flex: 1, padding: "8px", background: "transparent", border: `1px dashed ${MUTED}`, borderRadius: "6px", color: MUTED, fontFamily: "inherit", fontSize: "11px", cursor: "pointer" }}
              >
                ↑ Upload CSV
              </button>
              <button
                onClick={() => setShowAddForm((v) => !v)}
                style={{ padding: "8px 12px", background: showAddForm ? `${ACCENT}22` : "transparent", border: `1px solid ${showAddForm ? ACCENT : BORDER}`, borderRadius: "6px", color: showAddForm ? ACCENT : MUTED, fontFamily: "inherit", fontSize: "11px", cursor: "pointer" }}
              >
                + Add
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleFileUpload} />
            <div style={{ fontSize: "10px", color: MUTED, textAlign: "center" }}>Columns: name, phone, contact, industry</div>

            {/* Add client form */}
            {showAddForm && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <input style={inp} placeholder="Company name *" value={newClient.name} onChange={(e) => setNewClient((p) => ({ ...p, name: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addClient()} />
                <input style={inp} placeholder="Contact person" value={newClient.contact} onChange={(e) => setNewClient((p) => ({ ...p, contact: e.target.value }))} />
                <input style={inp} placeholder="Phone number" value={newClient.phone} onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))} />
                <input style={inp} placeholder="Industry" value={newClient.industry} onChange={(e) => setNewClient((p) => ({ ...p, industry: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addClient()} />
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={addClient} style={{ flex: 1, padding: "7px", background: `${ACCENT}22`, border: `1px solid ${ACCENT}44`, borderRadius: "5px", color: ACCENT, fontFamily: "inherit", fontSize: "11px", cursor: "pointer" }}>
                    Add Client
                  </button>
                  <button onClick={() => { setShowAddForm(false); setNewClient({ name: "", contact: "", phone: "", industry: "" }); }} style={{ padding: "7px 12px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: "5px", color: MUTED, fontFamily: "inherit", fontSize: "11px", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${BORDER}` }}>
            <input
              style={{ ...inp, marginBottom: 0 }}
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Client list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "0.12em", color: MUTED, textTransform: "uppercase", marginBottom: "8px", paddingLeft: "4px" }}>
              Clients ({filteredClients.length}{search ? ` of ${clients.length}` : ""})
            </div>

            {filteredClients.length === 0 && (
              <div style={{ textAlign: "center", color: MUTED, fontSize: "11px", padding: "24px 0" }}>
                {search ? "No clients match your search" : "No clients yet — upload a CSV or add manually"}
              </div>
            )}

            {filteredClients.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${selected === c.id ? ACCENT : BORDER}`,
                  marginBottom: "6px",
                  cursor: "pointer",
                  background: selected === c.id ? `${ACCENT}0D` : "transparent",
                  transition: "all 0.15s",
                  position: "relative",
                }}
                onClick={() => { setSelected(c.id); setConfirmDeleteId(null); }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: TEXT, display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
                    <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0, background: statusColor(c.status) }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  </div>
                  {/* Delete button */}
                  {confirmDeleteId === c.id ? (
                    <div style={{ display: "flex", gap: "4px", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => deleteClient(c.id)} style={{ padding: "2px 8px", background: `${DANGER}22`, border: `1px solid ${DANGER}66`, borderRadius: "4px", color: DANGER, fontSize: "10px", cursor: "pointer", fontFamily: "inherit" }}>
                        Confirm
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ padding: "2px 6px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: "4px", color: MUTED, fontSize: "10px", cursor: "pointer", fontFamily: "inherit" }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                      style={{ padding: "2px 6px", background: "transparent", border: "none", color: MUTED, fontSize: "12px", cursor: "pointer", opacity: 0.5, flexShrink: 0 }}
                      title="Delete client"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px", paddingLeft: "12px" }}>
                  {c.contact && <span>{c.contact} · </span>}
                  <span>{c.phone}</span>
                  {c.industry && (
                    <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: "3px", fontSize: "10px", background: `${INFO}22`, color: INFO, border: `1px solid ${INFO}44`, marginLeft: "6px" }}>
                      {c.industry}
                    </span>
                  )}
                </div>

                {c.notes && (
                  <div style={{ fontSize: "10px", color: MUTED, marginTop: "4px", paddingLeft: "12px", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    → {c.notes.split("\n").pop()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: BG, minWidth: 0 }}>
          {!selectedClient ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: MUTED, gap: "14px" }}>
              <div style={{ fontSize: "40px" }}>☎</div>
              <div style={{ fontSize: "14px", color: TEXT }}>Select a client to start calling</div>
              <div style={{ fontSize: "11px" }}>Upload your CSV or use the sample clients on the left</div>
              <div style={{ fontSize: "10px", marginTop: "4px", padding: "8px 16px", background: `${ACCENT}0A`, border: `1px solid ${ACCENT}22`, borderRadius: "6px", color: ACCENT, maxWidth: "340px", textAlign: "center", lineHeight: "1.7" }}>
                Business info in any language → {settings.targetLang} scripts.<br />Add your OpenAI key in ⚙ Settings · new here? tap ? Help
              </div>
            </div>
          ) : (
            <>
              {/* Client header */}
              <div style={{ padding: "16px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: "10px", color: MUTED, letterSpacing: "0.12em", marginBottom: "4px" }}>
                    {selectedClient.name.toUpperCase()}
                    {selectedClient.industry && <span style={{ color: INFO, marginLeft: "8px" }}>· {selectedClient.industry}</span>}
                  </div>
                  {/* Phone number — tap to dial on mobile */}
                  <a
                    href={`tel:${selectedClient.phone.replace(/[^+\d]/g, "")}`}
                    style={{ textDecoration: "none" }}
                    title="Tap to dial"
                  >
                    <div style={{ fontSize: "22px", letterSpacing: "0.08em", color: ACCENT, fontWeight: "700", cursor: "pointer" }}>
                      📞 {selectedClient.phone}
                    </div>
                  </a>
                  <div style={{ fontSize: "10px", color: MUTED, marginTop: "3px" }}>Tap number to dial · or use CALL button →</div>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <button
                    onClick={handleGenerateScript}
                    disabled={loading}
                    style={{
                      padding: "9px 18px",
                      background: `${ACCENT}22`,
                      border: `1px solid ${ACCENT}44`,
                      borderRadius: "6px",
                      color: ACCENT,
                      fontFamily: "inherit",
                      fontSize: "12px",
                      cursor: loading ? "not-allowed" : "pointer",
                      letterSpacing: "0.05em",
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ display: "inline-block", width: "10px", height: "10px", border: `2px solid ${ACCENT}44`, borderTop: `2px solid ${ACCENT}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        Generating...
                      </span>
                    ) : script ? "↺ Regenerate" : "⚡ Generate Script"}
                  </button>
                  <button
                    onClick={startAiCall}
                    disabled={aiCalling}
                    title="AI calls the number, talks to the prospect in English, and logs the lead automatically"
                    style={{
                      padding: "9px 18px",
                      background: aiCalling ? `${INFO}22` : INFO,
                      border: `1px solid ${INFO}`,
                      borderRadius: "6px",
                      color: aiCalling ? INFO : "#000",
                      fontFamily: "inherit",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: aiCalling ? "not-allowed" : "pointer",
                      letterSpacing: "0.05em",
                      minWidth: "130px",
                    }}
                  >
                    {aiCalling ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                        <span style={{ display: "inline-block", width: "10px", height: "10px", border: `2px solid ${INFO}44`, borderTop: `2px solid ${INFO}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        AI calling…
                      </span>
                    ) : "🤖 AI Call"}
                  </button>
                  {calling ? (
                    <button
                      onClick={() => setCalling(false)}
                      style={{ padding: "9px 20px", background: DANGER, border: "none", borderRadius: "6px", color: "#fff", fontFamily: "inherit", fontSize: "12px", fontWeight: "700", cursor: "pointer", letterSpacing: "0.08em", minWidth: "120px" }}
                    >
                      ⏹ END  {formatTime(callTime)}
                    </button>
                  ) : (
                    <a
                      href={`tel:${selectedClient.phone.replace(/[^+\d]/g, "")}`}
                      onClick={() => setCalling(true)}
                      style={{ textDecoration: "none" }}
                    >
                      <button
                        style={{ padding: "9px 20px", background: ACCENT, border: "none", borderRadius: "6px", color: "#000", fontFamily: "inherit", fontSize: "12px", fontWeight: "700", cursor: "pointer", letterSpacing: "0.08em", minWidth: "120px" }}
                      >
                        📞 CALL NOW
                      </button>
                    </a>
                  )}
                </div>
              </div>

              {/* Script area */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

                {/* Call in progress banner */}
                {calling && (
                  <div style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}33`, borderRadius: "8px", padding: "14px 18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: ACCENT, animation: "pulse 1s infinite", flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: "12px", color: ACCENT, letterSpacing: "0.1em" }}>CALL IN PROGRESS</span>
                    <span style={{ fontSize: "13px", color: ACCENT, fontWeight: "700", marginLeft: "4px" }}>{formatTime(callTime)}</span>
                    <span style={{ fontSize: "11px", color: MUTED, marginLeft: "auto" }}>{selectedClient.name} · {selectedClient.phone}</span>
                  </div>
                )}

                {/* AI call in progress */}
                {aiCalling && (
                  <div style={{ background: `${INFO}0A`, border: `1px solid ${INFO}44`, borderRadius: "8px", padding: "14px 18px", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: INFO, animation: "pulse 1s infinite", flexShrink: 0, display: "inline-block" }} />
                      <span style={{ fontSize: "12px", color: INFO, letterSpacing: "0.1em" }}>🤖 AI AGENT · {aiStatusLabel(aiStatus).toUpperCase()}</span>
                      <span style={{ fontSize: "11px", color: MUTED, marginLeft: "auto" }}>{selectedClient.name} · {selectedClient.phone}</span>
                    </div>
                    {aiTranscript.length > 0 && (
                      <div style={{ marginTop: "12px", borderTop: `1px solid ${INFO}22`, paddingTop: "10px", maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {aiTranscript.map((t, i) => (
                          <div key={i} style={{ fontSize: "12px", lineHeight: "1.6", color: t.role === "agent" ? TEXT : MUTED }}>
                            <span style={{ color: t.role === "agent" ? INFO : ACCENT, fontWeight: "600" }}>{t.role === "agent" ? "Agent" : "Prospect"}:</span> {t.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* AI call result */}
                {aiResult && (
                  <div style={{ background: CARD, border: `1px solid ${INFO}44`, borderRadius: "8px", padding: "18px 20px", marginBottom: "16px" }}>
                    <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: INFO, textTransform: "uppercase", marginBottom: "10px" }}>🤖 AI Call Result</div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                      <span style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "4px", background: aiResult.isLead ? `${ACCENT}22` : `${MUTED}22`, color: aiResult.isLead ? ACCENT : MUTED, border: `1px solid ${aiResult.isLead ? ACCENT : BORDER}` }}>
                        {aiResult.isLead ? "✓ Lead" : "Not a lead"}
                      </span>
                      <span style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "4px", background: `${INFO}22`, color: INFO, border: `1px solid ${INFO}44` }}>
                        Interest: {aiResult.interestLevel}
                      </span>
                      {aiResult.meetingRequested && (
                        <span style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "4px", background: `${ACCENT}22`, color: ACCENT, border: `1px solid ${ACCENT}44` }}>
                          📅 Meeting{aiResult.meetingTime ? `: ${aiResult.meetingTime}` : " requested"}
                        </span>
                      )}
                    </div>
                    {aiResult.summary && <div style={{ fontSize: "13px", lineHeight: "1.8", color: TEXT, whiteSpace: "pre-wrap" }}>{aiResult.summary}</div>}
                    {aiResult.transcript && (
                      <details style={{ marginTop: "10px" }}>
                        <summary style={{ fontSize: "11px", color: MUTED, cursor: "pointer" }}>View transcript</summary>
                        <div style={{ fontSize: "12px", color: MUTED, lineHeight: "1.7", whiteSpace: "pre-wrap", marginTop: "8px" }}>{aiResult.transcript}</div>
                      </details>
                    )}
                  </div>
                )}

                {/* Loading state */}
                {loading && (
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "48px 24px", textAlign: "center", marginBottom: "16px" }}>
                    <div style={{ display: "inline-block", width: "22px", height: "22px", border: `2px solid ${ACCENT}33`, borderTop: `2px solid ${ACCENT}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    <div style={{ fontSize: "12px", color: MUTED, marginTop: "14px" }}>
                      Generating personalized script for {selectedClient.name}...
                    </div>
                  </div>
                )}

                {/* Script sections */}
                {!loading && script && Object.entries(script).map(([section, text]) =>
                  text ? (
                    <div key={section} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "18px 20px", marginBottom: "14px" }}>
                      <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: MUTED, textTransform: "uppercase", marginBottom: "10px" }}>{section}</div>
                      <div style={{ fontSize: "13px", lineHeight: "1.85", color: TEXT, whiteSpace: "pre-wrap" }}>{text}</div>
                    </div>
                  ) : null
                )}

                {/* Empty script state */}
                {!loading && !script && (
                  <div style={{ textAlign: "center", padding: "72px 24px", color: MUTED }}>
                    <div style={{ fontSize: "32px", marginBottom: "14px" }}>✦</div>
                    <div style={{ fontSize: "13px", marginBottom: "8px", color: TEXT }}>No script generated yet</div>
                    <div style={{ fontSize: "11px", lineHeight: "1.7" }}>
                      Click <span style={{ color: ACCENT }}>"⚡ Generate Script"</span> to create a personalized
                      <br />English cold call script for {selectedClient.name}
                    </div>
                    <div style={{ fontSize: "10px", marginTop: "16px", color: MUTED }}>
                      Any input language → {settings.targetLang}. Uses your OpenAI key (⚙ Settings); falls back to an offline template if no key is set.
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedClient.notes && (
                  <div style={{ background: CARD, border: `1px solid ${WARN}33`, borderRadius: "8px", padding: "18px 20px", marginTop: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                      <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: MUTED, textTransform: "uppercase" }}>Call Notes</div>
                      <button onClick={clearAllNotes} style={{ fontSize: "10px", color: MUTED, background: "transparent", border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "2px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                        Clear all
                      </button>
                    </div>
                    {selectedClient.notes.split("\n").map((n, i) => (
                      <div key={i} style={{ fontSize: "12px", color: MUTED, lineHeight: "1.8" }}>→ {n}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom bar */}
              <div style={{ borderTop: `1px solid ${BORDER}`, padding: "14px 24px", display: "flex", gap: "10px", flexShrink: 0, background: CARD, alignItems: "center" }}>
                <input
                  style={{ flex: 1, background: BG, border: `1px solid ${BORDER}`, borderRadius: "6px", color: TEXT, fontFamily: "inherit", fontSize: "12px", padding: "9px 14px", outline: "none" }}
                  placeholder="Add call note... (Enter to save)"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveNote()}
                />
                <button
                  onClick={saveNote}
                  style={{ padding: "9px 14px", background: `${ACCENT}22`, border: `1px solid ${ACCENT}44`, borderRadius: "6px", color: ACCENT, fontFamily: "inherit", fontSize: "11px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Save Note
                </button>
                <div style={{ display: "flex", gap: "6px" }}>
                  {[
                    { label: "✓ Lead", status: "converted", color: ACCENT },
                    { label: "↺ Follow-up", status: "follow-up", color: WARN },
                    { label: "✗ No", status: "not-interested", color: DANGER },
                  ].map(({ label, status, color }) => (
                    <button
                      key={status}
                      onClick={() => setStatus(status)}
                      style={{
                        padding: "8px 12px",
                        background: selectedClient.status === status ? `${color}22` : "transparent",
                        border: `1px solid ${selectedClient.status === status ? color : BORDER}`,
                        borderRadius: "6px",
                        color: selectedClient.status === status ? color : MUTED,
                        fontFamily: "inherit",
                        fontSize: "11px",
                        cursor: "pointer",
                        letterSpacing: "0.04em",
                        transition: "all 0.15s",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
