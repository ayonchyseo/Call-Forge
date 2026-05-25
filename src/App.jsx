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
Offer: Free website audit + 1 month free social media management
Target: SME businesses in Bangladesh`;

const SAMPLE_CLIENTS = [
  { id: 1, name: "Rahim Telecom", contact: "Mr. Rahim", phone: "01711-234567", industry: "Telecom", notes: "", status: "new", script: null },
  { id: 2, name: "Dhaka Logistics Ltd", contact: "Ms. Nadia", phone: "01812-345678", industry: "Logistics", notes: "", status: "new", script: null },
  { id: 3, name: "GreenTech BD", contact: "Mr. Karim", phone: "01955-456789", industry: "Technology", notes: "", status: "new", script: null },
];

// ── Industry-specific script content ──────────────────────────────────────────
const INDUSTRY_MAP = {
  telecom: {
    pain: "customer acquisition cost বৃদ্ধি এবং market competition",
    benefit: "নতুন customer আনতে ও existing customer retain করতে",
    objection: "আমাদের নিজস্ব marketing team আছে",
    objReply: "অবশ্যই! আমরা আপনার team-কে replace করতে আসিনি — বরং তাদের efforts amplify করতে এসেছি। একসাথে কাজ করলে results অনেক ভালো আসে।",
  },
  logistics: {
    pain: "delivery efficiency এবং real-time tracking-এর চ্যালেঞ্জ",
    benefit: "delivery cost কমাতে ও customer satisfaction বাড়াতে",
    objection: "আমাদের budget এখন tight",
    objReply: "আমি বুঝতে পারছি। তাই আমরা প্রথমে একটি free audit offer করছি — কোনো cost ছাড়াই দেখুন কোথায় সুযোগ আছে।",
  },
  technology: {
    pain: "digital presence এবং qualified lead generation-এর সমস্যা",
    benefit: "online visibility বাড়াতে ও qualified leads পেতে",
    objection: "আমরা ইতিমধ্যে digital marketing করছি",
    objReply: "দারুণ! তাহলে আমরা আপনার current strategy review করে দেখাতে পারি কোথায় ROI আরো বাড়ানো যায়।",
  },
  healthcare: {
    pain: "patient acquisition এবং appointment management",
    benefit: "নতুন patient পেতে ও appointment rate বাড়াতে",
    objection: "Healthcare-এ digital marketing কাজ করে না",
    objReply: "আসলে healthcare sector-এ digital marketing সবচেয়ে দ্রুত বাড়ছে। আমাদের healthcare clients গড়ে ৪০% বেশি appointment পাচ্ছেন।",
  },
  education: {
    pain: "student enrollment কমা এবং brand awareness-এর ঘাটতি",
    benefit: "enrollment বাড়াতে ও শক্তিশালী brand তৈরি করতে",
    objection: "Students আমাদের খুঁজে নেয়",
    objReply: "সত্যি কথা! কিন্তু competition বাড়ছে। সঠিক digital strategy থাকলে আরো বেশি students reach করা সম্ভব।",
  },
  finance: {
    pain: "client trust building এবং new lead generation",
    benefit: "নতুন clients পেতে ও brand credibility বাড়াতে",
    objection: "Finance sector-এ compliance issue আছে",
    objReply: "আমরা finance sector compliance সম্পর্কে পুরোপুরি aware। আমাদের সব strategy নিয়মকানুন মেনে তৈরি করা হয়।",
  },
  retail: {
    pain: "foot traffic কমা এবং online sales growth-এর চ্যালেঞ্জ",
    benefit: "customer base বাড়াতে ও repeat purchase বাড়াতে",
    objection: "আমাদের business seasonal",
    objReply: "Seasonal business-এর জন্য আমাদের কাছে বিশেষ strategy আছে — peak season maximize করা এবং off-season-এও revenue maintain করা।",
  },
  manufacturing: {
    pain: "B2B client acquisition এবং market expansion",
    benefit: "নতুন buyers পেতে ও market expand করতে",
    objection: "আমরা word-of-mouth-এ চলি",
    objReply: "Word-of-mouth excellent! Digital presence থাকলে সেটা আরো amplify হয় — international buyers আপনাদের আরো সহজে খুঁজে পাবেন।",
  },
  realestate: {
    pain: "property listing visibility এবং qualified buyer পাওয়া",
    benefit: "property দ্রুত sell/rent করতে ও premium buyers পেতে",
    objection: "আমরা portal-এ listed আছি",
    objReply: "Portal listing ভালো, কিন্তু targeted social media ও SEO দিয়ে আরো qualified buyer reach করা যায়।",
  },
  food: {
    pain: "customer loyalty ধরে রাখা এবং online order growth",
    benefit: "regular customers ধরে রাখতে ও delivery order বাড়াতে",
    objection: "আমরা Pathao/Shohoz-এ আছি",
    objReply: "Third-party platform ভালো, কিন্তু নিজস্ব digital presence থাকলে commission দিতে হয় না ও direct customer relationship তৈরি হয়।",
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
  const info = { name: "আমাদের কোম্পানি", service: "আমাদের সার্ভিস", offer: "বিশেষ প্রস্তাব", target: "SME businesses" };
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
    pain: "business growth এবং market expansion",
    benefit: "নতুন clients পেতে ও revenue বাড়াতে",
    objection: "এখন সময় নেই",
    objReply: "অবশ্যই! তাহলে কি আগামী সপ্তাহে একটি convenient সময়ে কথা বলতে পারি?",
  };
  const contact = client.contact || "স্যার/ম্যাম";
  const company = client.name;
  const industry = client.industry || "business";

  return {
    OPENING:
`আস্সালামু আলাইকুম / নমস্কার।

আমি ${biz.name} থেকে বলছি। আপনি কি ${contact} বলছেন?

(হ্যাঁ বললে)
${contact}, আমি জানি আপনি অনেক ব্যস্ত। মাত্র ২ মিনিট সময় দিলে একটি গুরুত্বপূর্ণ বিষয় শেয়ার করতে চাই — আপনি কি এখন কথা বলতে পারবেন?`,

    HOOK:
`${company}-এর মতো ${industry} company গুলো প্রায়ই ${ind.pain}-এর challenge face করে।

আমরা এই ধরনের অনেক company-কে সাহায্য করেছি এবং তারা উল্লেখযোগ্য results পেয়েছেন।

আপনারাও কি এই বিষয়গুলো নিয়ে কাজ করছেন?`,

    PITCH:
`আমরা ${biz.service} provide করি, যা ${ind.benefit} সাহায্য করে।

${company}-এর জন্য আমরা বিশেষভাবে offer করছি:
  ✦ ${biz.offer}

এটি একটি risk-free সুযোগ। প্রথমে দেখুন, তারপর সিদ্ধান্ত নিন।
আমাদের clients সাধারণত ৩–৬ মাসের মধ্যে উল্লেখযোগ্য পরিবর্তন অনুভব করেন।`,

    "OBJECTION HANDLING":
`Objection ও Response Guide:

❶ যদি বলেন: "${ind.objection}"
   → ${ind.objReply}

❷ যদি বলেন: "আমাদের budget নেই"
   → "আমি বুঝতে পারছি। তাই আমরা flexible payment option রেখেছি। আর ${biz.offer} — এটা risk ছাড়াই শুরু করার সুযোগ দেয়।"

❸ যদি বলেন: "পরে call করুন"
   → "অবশ্যই! কবে call করলে আপনার সুবিধা হবে? আগামী সপ্তাহে Tuesday বা Wednesday কেমন?"

❹ যদি বলেন: "আমি জানি না, দেখি"
   → "একদম ঠিক আছে। একটি ছোট meeting-এ সব details দেখলে সিদ্ধান্ত নেওয়া সহজ হবে — মাত্র ১৫ মিনিট।"`,

    "MEETING CLOSE":
`${contact}, আপনার সাথে কথা বলে অনেক ভালো লাগলো।

আপনার সুবিধামতো সময়ে একটি ছোট ১৫–২০ মিনিটের meeting করতে পারি?
সেখানে আমরা ${company}-এর specific situation অনুযায়ী একটি customized plan present করব।

এই সপ্তাহে বা আগামী সপ্তাহে — কোন দিন এবং সময় আপনার জন্য সুবিধাজনক?
(Phone / Zoom / সরাসরি — যেটা আপনার জন্য ভালো)`,

    CLOSING:
`অনেক ধন্যবাদ আপনার মূল্যবান সময়ের জন্য।

Meeting confirm হলে আমি { meeting এর তারিখ ও সময় বলুন }-এ একটি reminder পাঠাব।

আমার contact নম্বর: { আপনার নিজের ফোন নম্বর বলুন }
যেকোনো প্রশ্নে সরাসরি call করতে পারেন।

আপনার একটি সুন্দর দিন হোক।
আস্সালামু আলাইকুম।

─────────────────────────────
💡 দ্রষ্টব্য: { } চিহ্নিত অংশগুলো call করার সময় নিজে বলুন।`,
  };
}

// ── Flatten a generated script object into plain text for the AI agent ────────
function scriptToText(script) {
  if (!script) return "";
  return Object.entries(script)
    .map(([section, text]) => `## ${section}\n${text}`)
    .join("\n\n");
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

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
  const fileRef = useRef();
  const timerRef = useRef();
  const aiPollRef = useRef();

  const selectedClient = clients.find((c) => c.id === selected);

  // Persist data
  useEffect(() => { saveState("cf_clients", clients); }, [clients]);
  useEffect(() => { saveState("cf_business", businessInfo); }, [businessInfo]);

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

  function handleGenerateScript() {
    if (!selectedClient || !businessInfo.trim()) {
      toast("Fill in your business info first", "warn");
      return;
    }
    setLoading(true);
    // Small delay so the spinner renders before the sync work
    setTimeout(() => {
      try {
        const script = generateScript(selectedClient, businessInfo);
        setClients((prev) => prev.map((c) => (c.id === selected ? { ...c, script } : c)));
        toast("Script generated");
      } catch {
        toast("Script generation failed — please try again", "error");
      }
      setLoading(false);
    }, 600);
  }

  // ── Start an autonomous AI phone call via the backend ─────────────────────
  async function startAiCall() {
    if (!selectedClient) return;
    let script = selectedClient.script;
    if (!script) {
      script = generateScript(selectedClient, businessInfo);
      setClients((prev) => prev.map((c) => (c.id === selected ? { ...c, script } : c)));
    }
    setAiResult(null);
    setAiCalling(true);
    try {
      const res = await fetch(`${API_URL}/api/ai-call`, {
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start AI call");
      toast("AI call started — agent is dialing");
      pollAiCall(data.callId, selectedClient.id);
    } catch (err) {
      setAiCalling(false);
      toast(err.message.includes("fetch") ? "Cannot reach AI backend — is `npm run server` running?" : err.message, "error");
    }
  }

  function pollAiCall(callId, clientId) {
    clearInterval(aiPollRef.current);
    aiPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/ai-call/${callId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "completed" && data.result) {
          clearInterval(aiPollRef.current);
          setAiCalling(false);
          setAiResult(data.result);
          applyAiResult(clientId, data.result);
        }
      } catch { /* keep polling */ }
    }, 4000);
  }

  function applyAiResult(clientId, result) {
    const status = result.meetingRequested || result.isLead
      ? "converted"
      : result.interestLevel === "low" ? "follow-up" : "not-interested";
    const ts = new Date().toLocaleString("en-BD", { dateStyle: "short", timeStyle: "short" });
    const parts = [`[${ts}] 🤖 AI call: ${result.summary || "(no summary)"}`];
    if (result.meetingTime) parts.push(`Meeting: ${result.meetingTime}`);
    const entry = parts.join(" | ");
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, status, notes: c.notes ? c.notes + "\n" + entry : entry } : c))
    );
    toast(result.meetingRequested ? "Meeting booked by AI ✓" : result.isLead ? "Lead captured by AI ✓" : "AI call finished");
  }

  function saveNote() {
    if (!noteInput.trim() || !selected) return;
    const ts = new Date().toLocaleString("en-BD", { dateStyle: "short", timeStyle: "short" });
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

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", background: CARD, flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "700", letterSpacing: "0.12em", color: ACCENT }}>⬡ CALLFORGE</div>
        <div style={{ display: "flex", gap: "20px", fontSize: "11px", color: MUTED }}>
          <span>Total <span style={{ color: TEXT }}>{stats.total}</span></span>
          <span>Leads <span style={{ color: ACCENT }}>{stats.converted}</span></span>
          <span>Follow-up <span style={{ color: WARN }}>{stats.followUp}</span></span>
          <span>Declined <span style={{ color: DANGER }}>{stats.notInterested}</span></span>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button onClick={exportCSV} style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: "5px", color: MUTED, padding: "5px 12px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>
            ↓ Export
          </button>
          <div style={{ background: `${ACCENT}22`, color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: "4px", padding: "4px 10px", fontSize: "10px", letterSpacing: "0.08em" }}>
            TEMPLATE ENGINE
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Sidebar ── */}
        <div style={{ width: "300px", flexShrink: 0, borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", overflow: "hidden", background: CARD }}>

          {/* Business info */}
          <div style={{ padding: "16px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: MUTED, textTransform: "uppercase", marginBottom: "8px" }}>Your Business</div>
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
              <div style={{ fontSize: "10px", marginTop: "4px", padding: "8px 16px", background: `${ACCENT}0A`, border: `1px solid ${ACCENT}22`, borderRadius: "6px", color: ACCENT, maxWidth: "320px", textAlign: "center", lineHeight: "1.7" }}>
                Scripts are generated instantly — no internet or API key needed
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
                  <div style={{ background: `${INFO}0A`, border: `1px solid ${INFO}44`, borderRadius: "8px", padding: "14px 18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: INFO, animation: "pulse 1s infinite", flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: "12px", color: INFO, letterSpacing: "0.1em" }}>🤖 AI AGENT ON CALL</span>
                    <span style={{ fontSize: "11px", color: MUTED, marginLeft: "auto" }}>{selectedClient.name} · {selectedClient.phone}</span>
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
                      <br />Bangla cold call script for {selectedClient.name}
                    </div>
                    <div style={{ fontSize: "10px", marginTop: "16px", color: MUTED }}>
                      Scripts use your business info + industry-specific templates — no API needed
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
