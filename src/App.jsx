import { useState, useRef } from "react";

const ACCENT = "#00FF94";
const BG = "#0A0A0F";
const CARD = "#12121A";
const BORDER = "#1E1E2E";
const MUTED = "#4A4A6A";
const TEXT = "#E8E8F0";

const styles = {
  app: {
    minHeight: "100vh",
    background: BG,
    color: TEXT,
    fontFamily: "'DM Mono', 'Courier New', monospace",
    padding: "0",
  },
  header: {
    borderBottom: `1px solid ${BORDER}`,
    padding: "20px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: CARD,
  },
  logo: {
    fontSize: "18px",
    fontWeight: "700",
    letterSpacing: "0.1em",
    color: ACCENT,
    textTransform: "uppercase",
  },
  badge: {
    background: `${ACCENT}22`,
    color: ACCENT,
    border: `1px solid ${ACCENT}44`,
    borderRadius: "4px",
    padding: "4px 10px",
    fontSize: "11px",
    letterSpacing: "0.08em",
  },
  main: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    height: "calc(100vh - 61px)",
    overflow: "hidden",
  },
  sidebar: {
    borderRight: `1px solid ${BORDER}`,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: CARD,
  },
  sidebarSection: {
    padding: "20px",
    borderBottom: `1px solid ${BORDER}`,
  },
  sectionLabel: {
    fontSize: "10px",
    letterSpacing: "0.15em",
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: "12px",
  },
  textarea: {
    width: "100%",
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: "6px",
    color: TEXT,
    fontFamily: "inherit",
    fontSize: "12px",
    padding: "10px",
    resize: "none",
    outline: "none",
    lineHeight: "1.6",
    boxSizing: "border-box",
  },
  uploadBtn: {
    width: "100%",
    padding: "10px",
    background: "transparent",
    border: `1px dashed ${MUTED}`,
    borderRadius: "6px",
    color: MUTED,
    fontFamily: "inherit",
    fontSize: "12px",
    cursor: "pointer",
    transition: "all 0.2s",
    letterSpacing: "0.05em",
  },
  clientList: {
    flex: 1,
    overflowY: "auto",
    padding: "12px",
  },
  clientCard: (active, status) => ({
    padding: "12px",
    borderRadius: "6px",
    border: `1px solid ${active ? ACCENT : BORDER}`,
    marginBottom: "8px",
    cursor: "pointer",
    background: active ? `${ACCENT}11` : "transparent",
    transition: "all 0.15s",
  }),
  clientName: {
    fontSize: "13px",
    fontWeight: "600",
    color: TEXT,
    marginBottom: "3px",
  },
  clientMeta: {
    fontSize: "11px",
    color: MUTED,
  },
  statusDot: (status) => ({
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    marginRight: "6px",
    background:
      status === "converted"
        ? "#00FF94"
        : status === "follow-up"
        ? "#FFB800"
        : status === "not-interested"
        ? "#FF4444"
        : "#4A4A6A",
  }),
  content: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: BG,
  },
  contentHeader: {
    padding: "20px 28px",
    borderBottom: `1px solid ${BORDER}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  phoneDisplay: {
    fontSize: "22px",
    letterSpacing: "0.08em",
    color: ACCENT,
    fontWeight: "700",
  },
  callBtn: (calling) => ({
    padding: "10px 24px",
    background: calling ? "#FF4444" : ACCENT,
    border: "none",
    borderRadius: "6px",
    color: calling ? "#fff" : "#000",
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    letterSpacing: "0.08em",
    transition: "all 0.2s",
  }),
  scriptArea: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 28px",
  },
  scriptBlock: {
    background: CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: "8px",
    padding: "20px",
    marginBottom: "16px",
  },
  scriptLabel: {
    fontSize: "10px",
    letterSpacing: "0.15em",
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: "10px",
  },
  scriptText: {
    fontSize: "13px",
    lineHeight: "1.8",
    color: TEXT,
    whiteSpace: "pre-wrap",
  },
  bottomBar: {
    borderTop: `1px solid ${BORDER}`,
    padding: "16px 28px",
    display: "flex",
    gap: "12px",
    flexShrink: 0,
    background: CARD,
  },
  noteInput: {
    flex: 1,
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: "6px",
    color: TEXT,
    fontFamily: "inherit",
    fontSize: "12px",
    padding: "10px 14px",
    outline: "none",
  },
  statusBtns: {
    display: "flex",
    gap: "8px",
  },
  statusBtn: (color, active) => ({
    padding: "8px 14px",
    background: active ? `${color}22` : "transparent",
    border: `1px solid ${active ? color : BORDER}`,
    borderRadius: "6px",
    color: active ? color : MUTED,
    fontFamily: "inherit",
    fontSize: "11px",
    cursor: "pointer",
    letterSpacing: "0.05em",
    transition: "all 0.15s",
  }),
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: MUTED,
    gap: "12px",
  },
  generateBtn: {
    padding: "10px 20px",
    background: `${ACCENT}22`,
    border: `1px solid ${ACCENT}44`,
    borderRadius: "6px",
    color: ACCENT,
    fontFamily: "inherit",
    fontSize: "12px",
    cursor: "pointer",
    letterSpacing: "0.05em",
    transition: "all 0.2s",
  },
  spinner: {
    display: "inline-block",
    width: "12px",
    height: "12px",
    border: `2px solid ${ACCENT}33`,
    borderTop: `2px solid ${ACCENT}`,
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    marginRight: "8px",
  },
  input: {
    width: "100%",
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: "6px",
    color: TEXT,
    fontFamily: "inherit",
    fontSize: "12px",
    padding: "8px 10px",
    outline: "none",
    marginBottom: "8px",
    boxSizing: "border-box",
  },
  tag: (color) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "3px",
    fontSize: "10px",
    background: `${color}22`,
    color: color,
    border: `1px solid ${color}44`,
    marginLeft: "8px",
    letterSpacing: "0.05em",
  }),
};

const SAMPLE_CLIENTS = [
  { id: 1, name: "Rahim Telecom", contact: "Mr. Rahim", phone: "01711-234567", industry: "Telecom", notes: "", status: "new" },
  { id: 2, name: "Dhaka Logistics Ltd", contact: "Ms. Nadia", phone: "01812-345678", industry: "Logistics", notes: "", status: "new" },
  { id: 3, name: "GreenTech BD", contact: "Mr. Karim", phone: "01955-456789", industry: "Technology", notes: "", status: "new" },
];

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  return lines.slice(1).map((line, i) => {
    const vals = line.split(",").map((v) => v.trim().replace(/"/g, ""));
    const obj = { id: Date.now() + i, status: "new", notes: "" };
    headers.forEach((h, idx) => {
      if (h.includes("name") || h.includes("company")) obj.name = vals[idx] || "";
      else if (h.includes("contact") || h.includes("person")) obj.contact = vals[idx] || "";
      else if (h.includes("phone") || h.includes("number") || h.includes("mobile")) obj.phone = vals[idx] || "";
      else if (h.includes("industry") || h.includes("sector")) obj.industry = vals[idx] || "";
      else obj[h] = vals[idx] || "";
    });
    if (!obj.name) obj.name = vals[0] || `Client ${i + 1}`;
    if (!obj.phone) obj.phone = vals.find((v) => /\d{7,}/.test(v)) || "N/A";
    return obj;
  });
}

export default function App() {
  const [clients, setClients] = useState(SAMPLE_CLIENTS);
  const [selected, setSelected] = useState(null);
  const [businessInfo, setBusinessInfo] = useState(
    "Business: SoftPulse Agency\nService: Digital Marketing & Web Development\nOffer: Free website audit + 1 month free social media management\nTarget: SME businesses in Bangladesh"
  );
  const [script, setScript] = useState(null);
  const [loading, setLoading] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [calling, setCalling] = useState(false);
  const fileRef = useRef();

  const selectedClient = clients.find((c) => c.id === selected);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      if (parsed.length > 0) setClients((prev) => [...prev, ...parsed]);
    };
    reader.readAsText(file);
  };

  const generateScript = async () => {
    if (!selectedClient || !businessInfo) return;
    setLoading(true);
    setScript(null);
    try {
      const prompt = `You are a professional cold calling assistant in Bangladesh. Generate a structured cold call script in Bangla (mixed with some English where natural) for the following scenario:

BUSINESS INFO:
${businessInfo}

CLIENT INFO:
Company: ${selectedClient.name}
Contact Person: ${selectedClient.contact || "Decision Maker"}
Phone: ${selectedClient.phone}
Industry: ${selectedClient.industry || "Business"}

Generate a cold call script with these sections:
1. OPENING (greeting and introduction - 2-3 sentences)
2. HOOK (pain point or value proposition - 2-3 sentences)
3. PITCH (what you offer - 3-4 sentences)
4. OBJECTION HANDLING (2-3 common objections with responses)
5. MEETING CLOSE (ask for a meeting - 2-3 sentences)
6. CLOSING (wrap up professionally)

Keep it natural, conversational, and persuasive. Use "আপনি" for respect. Make it specific to their industry.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const text = data.content?.map((b) => b.text || "").join("") || "Script generation failed.";

      const sections = {};
      const sectionNames = ["OPENING", "HOOK", "PITCH", "OBJECTION HANDLING", "MEETING CLOSE", "CLOSING"];
      sectionNames.forEach((name, i) => {
        const regex = new RegExp(`${i + 1}\\.\\s*${name}[:\\s]*(.*?)(?=${i + 2}\\.|$)`, "is");
        const match = text.match(regex);
        sections[name] = match ? match[1].trim() : "";
      });

      if (Object.values(sections).every((v) => !v)) {
        sections["FULL SCRIPT"] = text;
      }
      setScript(sections);
    } catch (err) {
      setScript({ ERROR: "Failed to generate script. Please try again." });
    }
    setLoading(false);
  };

  const saveNote = () => {
    if (!noteInput.trim() || !selected) return;
    setClients((prev) =>
      prev.map((c) =>
        c.id === selected ? { ...c, notes: c.notes ? c.notes + "\n" + noteInput : noteInput } : c
      )
    );
    setNoteInput("");
  };

  const setStatus = (status) => {
    if (!selected) return;
    setClients((prev) => prev.map((c) => (c.id === selected ? { ...c, status } : c)));
  };

  const stats = {
    total: clients.length,
    converted: clients.filter((c) => c.status === "converted").length,
    followUp: clients.filter((c) => c.status === "follow-up").length,
    notInterested: clients.filter((c) => c.status === "not-interested").length,
  };

  return (
    <div style={styles.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } 
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>

      <div style={styles.header}>
        <div style={styles.logo}>⬡ CALLFORGE</div>
        <div style={{ display: "flex", gap: "20px", fontSize: "12px", color: MUTED }}>
          <span>Total: <span style={{ color: TEXT }}>{stats.total}</span></span>
          <span>Leads: <span style={{ color: ACCENT }}>{stats.converted}</span></span>
          <span>Follow-up: <span style={{ color: "#FFB800" }}>{stats.followUp}</span></span>
          <span>Declined: <span style={{ color: "#FF4444" }}>{stats.notInterested}</span></span>
        </div>
        <div style={styles.badge}>AI POWERED</div>
      </div>

      <div style={styles.main}>
        {/* SIDEBAR */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarSection}>
            <div style={styles.sectionLabel}>Your Business</div>
            <textarea
              style={{ ...styles.textarea, height: "120px" }}
              value={businessInfo}
              onChange={(e) => setBusinessInfo(e.target.value)}
              placeholder="Business name, services, offer..."
            />
          </div>

          <div style={styles.sidebarSection}>
            <div style={styles.sectionLabel}>Client List</div>
            <button style={styles.uploadBtn} onClick={() => fileRef.current.click()}>
              ↑ Upload CSV / Excel
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleFileUpload} />
            <div style={{ fontSize: "10px", color: MUTED, marginTop: "6px", textAlign: "center" }}>
              Columns: name, phone, contact, industry
            </div>
          </div>

          <div style={styles.clientList}>
            <div style={styles.sectionLabel}>Clients ({clients.length})</div>
            {clients.map((c) => (
              <div
                key={c.id}
                style={styles.clientCard(selected === c.id, c.status)}
                onClick={() => { setSelected(c.id); setScript(null); setNoteInput(""); }}
              >
                <div style={styles.clientName}>
                  <span style={styles.statusDot(c.status)} />
                  {c.name}
                </div>
                <div style={styles.clientMeta}>
                  {c.contact && <span>{c.contact} · </span>}
                  <span>{c.phone}</span>
                  {c.industry && <span style={styles.tag("#7B8FFF")}>{c.industry}</span>}
                </div>
                {c.notes && (
                  <div style={{ fontSize: "10px", color: MUTED, marginTop: "4px", fontStyle: "italic" }}>
                    {c.notes.split("\n").pop()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={styles.content}>
          {!selectedClient ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: "32px" }}>☎</div>
              <div style={{ fontSize: "13px" }}>Select a client to start calling</div>
              <div style={{ fontSize: "11px", color: MUTED }}>Upload your CSV or use the sample clients</div>
            </div>
          ) : (
            <>
              <div style={styles.contentHeader}>
                <div>
                  <div style={{ fontSize: "11px", color: MUTED, marginBottom: "4px", letterSpacing: "0.1em" }}>
                    CALLING — {selectedClient.name.toUpperCase()}
                  </div>
                  <div style={styles.phoneDisplay}>{selectedClient.phone}</div>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  {!script && (
                    <button style={styles.generateBtn} onClick={generateScript} disabled={loading}>
                      {loading ? <><span style={styles.spinner} />Generating...</> : "⚡ Generate Script"}
                    </button>
                  )}
                  <button
                    style={styles.callBtn(calling)}
                    onClick={() => setCalling(!calling)}
                  >
                    {calling ? "⏹ END CALL" : "▶ START CALL"}
                  </button>
                </div>
              </div>

              <div style={styles.scriptArea}>
                {calling && (
                  <div style={{ ...styles.scriptBlock, borderColor: `${ACCENT}44`, background: `${ACCENT}08`, marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: ACCENT, animation: "pulse 1s infinite" }} />
                      <span style={{ fontSize: "12px", color: ACCENT, letterSpacing: "0.1em" }}>CALL IN PROGRESS</span>
                      <span style={{ fontSize: "11px", color: MUTED, marginLeft: "auto" }}>
                        {selectedClient.name} · {selectedClient.phone}
                      </span>
                    </div>
                  </div>
                )}

                {loading && (
                  <div style={{ ...styles.scriptBlock, textAlign: "center", padding: "40px" }}>
                    <div style={{ ...styles.spinner, width: "20px", height: "20px", display: "inline-block" }} />
                    <div style={{ fontSize: "12px", color: MUTED, marginTop: "12px" }}>
                      Generating personalized script for {selectedClient.name}...
                    </div>
                  </div>
                )}

                {script && Object.entries(script).map(([section, text]) => text && (
                  <div key={section} style={styles.scriptBlock}>
                    <div style={styles.scriptLabel}>{section}</div>
                    <div style={styles.scriptText}>{text}</div>
                  </div>
                ))}

                {!script && !loading && (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: MUTED }}>
                    <div style={{ fontSize: "28px", marginBottom: "12px" }}>✦</div>
                    <div style={{ fontSize: "13px", marginBottom: "8px" }}>No script generated yet</div>
                    <div style={{ fontSize: "11px" }}>Click "Generate Script" to create an AI call script for {selectedClient.name}</div>
                  </div>
                )}

                {selectedClient.notes && (
                  <div style={{ ...styles.scriptBlock, borderColor: "#FFB80033" }}>
                    <div style={styles.scriptLabel}>📝 Call Notes</div>
                    {selectedClient.notes.split("\n").map((n, i) => (
                      <div key={i} style={{ fontSize: "12px", color: MUTED, lineHeight: "1.8" }}>→ {n}</div>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.bottomBar}>
                <input
                  style={styles.noteInput}
                  placeholder="Add call note..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveNote()}
                />
                <button style={{ ...styles.generateBtn, whiteSpace: "nowrap" }} onClick={saveNote}>
                  Save Note
                </button>
                <div style={styles.statusBtns}>
                  <button style={styles.statusBtn(ACCENT, selectedClient.status === "converted")} onClick={() => setStatus("converted")}>✓ Lead</button>
                  <button style={styles.statusBtn("#FFB800", selectedClient.status === "follow-up")} onClick={() => setStatus("follow-up")}>↺ Follow-up</button>
                  <button style={styles.statusBtn("#FF4444", selectedClient.status === "not-interested")} onClick={() => setStatus("not-interested")}>✗ No</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
