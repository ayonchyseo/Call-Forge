// CallForge — bulk calling: campaign setup + live campaign dashboard.
//
// Two pieces:
//   • CampaignSetup  — the modal that configures and launches a campaign from a
//                      selected set of numbers (country + multiple office-hour
//                      windows, per-country overrides, retry rule, concurrency).
//   • CampaignsView  — full-screen list of campaigns and a per-number live
//                      dashboard (Attended / Missed / Declined / retry times).
//
// All scheduling/dialing happens on the SERVER (see server/scheduler.js); this
// UI only creates campaigns and polls their state.

import { useState, useEffect, useRef } from "react";
import { apiJson } from "./api.js";
import {
  BG, CARD, BORDER, TEXT, MUTED, ACCENT, ACCENT_TEXT, WARN, DANGER, INFO,
  SHADOW, SHADOW_LG, FONT,
} from "./theme.js";

// Friendly timezone choices for the campaign default + overrides.
const TIMEZONES = [
  { label: "Bangladesh — Asia/Dhaka", tz: "Asia/Dhaka" },
  { label: "India — Asia/Kolkata", tz: "Asia/Kolkata" },
  { label: "Pakistan — Asia/Karachi", tz: "Asia/Karachi" },
  { label: "UAE — Asia/Dubai", tz: "Asia/Dubai" },
  { label: "Singapore — Asia/Singapore", tz: "Asia/Singapore" },
  { label: "United Kingdom — Europe/London", tz: "Europe/London" },
  { label: "US Eastern — America/New_York", tz: "America/New_York" },
  { label: "US Central — America/Chicago", tz: "America/Chicago" },
  { label: "US Pacific — America/Los_Angeles", tz: "America/Los_Angeles" },
  { label: "Australia (Sydney) — Australia/Sydney", tz: "Australia/Sydney" },
  { label: "New Zealand — Pacific/Auckland", tz: "Pacific/Auckland" },
  { label: "UTC", tz: "UTC" },
];

// Suggested per-country overrides (calling code → a sensible timezone).
const COUNTRY_OPTIONS = [
  { code: "44", label: "United Kingdom (+44)", tz: "Europe/London" },
  { code: "1", label: "US / Canada (+1)", tz: "America/New_York" },
  { code: "61", label: "Australia (+61)", tz: "Australia/Sydney" },
  { code: "64", label: "New Zealand (+64)", tz: "Pacific/Auckland" },
  { code: "880", label: "Bangladesh (+880)", tz: "Asia/Dhaka" },
  { code: "91", label: "India (+91)", tz: "Asia/Kolkata" },
  { code: "971", label: "UAE (+971)", tz: "Asia/Dubai" },
  { code: "92", label: "Pakistan (+92)", tz: "Asia/Karachi" },
  { code: "65", label: "Singapore (+65)", tz: "Asia/Singapore" },
];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"]; // Sun..Sat

const inp = {
  width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: "6px",
  color: TEXT, fontFamily: "inherit", fontSize: "12px", padding: "8px 10px", outline: "none", boxSizing: "border-box",
};
const btn = (bg, color, border) => ({
  padding: "9px 16px", background: bg, border: `1px solid ${border}`, borderRadius: "7px",
  color, fontFamily: "inherit", fontSize: "12px", cursor: "pointer", fontWeight: 600,
});

function fmtTime(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  catch { return iso; }
}

// ── time-window editor (supports MULTIPLE windows per day) ───────────────────
function WindowsEditor({ windows, onChange }) {
  const set = (i, k, v) => onChange(windows.map((w, idx) => (idx === i ? { ...w, [k]: v } : w)));
  const add = () => onChange([...windows, { start: "10:00", end: "18:00" }]);
  const remove = (i) => onChange(windows.filter((_, idx) => idx !== i));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {windows.map((w, i) => (
        <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input type="time" style={{ ...inp, width: "auto", flex: 1 }} value={w.start} onChange={(e) => set(i, "start", e.target.value)} />
          <span style={{ color: MUTED, fontSize: "12px" }}>→</span>
          <input type="time" style={{ ...inp, width: "auto", flex: 1 }} value={w.end} onChange={(e) => set(i, "end", e.target.value)} />
          <button onClick={() => remove(i)} disabled={windows.length <= 1}
            style={{ ...btn("transparent", windows.length <= 1 ? BORDER : DANGER, BORDER), padding: "6px 10px", opacity: windows.length <= 1 ? 0.4 : 1 }}>✕</button>
        </div>
      ))}
      <button onClick={add} style={{ ...btn("transparent", ACCENT, `${ACCENT}66`), alignSelf: "flex-start", padding: "6px 12px" }}>+ Add time window</button>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ fontSize: "10px", letterSpacing: "0.12em", color: MUTED, textTransform: "uppercase", marginBottom: "6px", fontWeight: 700 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: "10px", color: MUTED, marginTop: "5px", lineHeight: 1.6 }}>{hint}</div>}
    </div>
  );
}

// ── campaign setup modal ─────────────────────────────────────────────────────
export function CampaignSetup({ clients, settings, businessInfo, token, onClose, onCreated, toast }) {
  const [name, setName] = useState(`Campaign · ${new Date().toLocaleDateString()}`);
  const [defaultTz, setDefaultTz] = useState("Asia/Dhaka");
  const [defaultWindows, setDefaultWindows] = useState([{ start: "10:00", end: "18:00" }]);
  const [days, setDays] = useState([true, true, true, true, true, true, true]);
  const [overrides, setOverrides] = useState([]); // [{code, tz, windows}]
  const [retryDelayMinutes, setRetryDelayMinutes] = useState(120);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [concurrency, setConcurrency] = useState(1);
  const [busy, setBusy] = useState(false);

  const valid = clients.filter((c) => { const d = String(c.phone || "").replace(/[^+\d]/g, ""); return d.length >= 8 && d.startsWith("+"); });
  const invalidCount = clients.length - valid.length;

  const addOverride = () => setOverrides((o) => [...o, { code: "44", tz: "Europe/London", windows: [{ start: "09:00", end: "17:00" }] }]);
  const setOverride = (i, patch) => setOverrides((o) => o.map((ov, idx) => (idx === i ? { ...ov, ...patch } : ov)));
  const removeOverride = (i) => setOverrides((o) => o.filter((_, idx) => idx !== i));

  async function launch() {
    if (!valid.length) { toast?.("None of the selected numbers are valid international (E.164) numbers.", "error"); return; }
    setBusy(true);
    try {
      const countryOverrides = {};
      for (const ov of overrides) {
        const code = String(ov.code).replace(/[^\d]/g, "");
        if (code) countryOverrides[code] = { tz: ov.tz, windows: ov.windows };
      }
      const body = {
        name,
        clients: clients.map((c) => ({ id: c.id, name: c.name, contact: c.contact, phone: c.phone, industry: c.industry })),
        defaultTz, defaultWindows, days, countryOverrides,
        retryDelayMinutes: Number(retryDelayMinutes), maxAttempts: Number(maxAttempts), concurrency: Number(concurrency),
        businessInfo,
        targetLang: settings.targetLang, aiInstructions: settings.aiInstructions, voice: settings.voice, accent: settings.accent,
        openaiKey: settings.openaiKey, twilioSid: settings.twilioSid, twilioToken: settings.twilioToken, twilioFrom: settings.twilioFrom,
      };
      const data = await apiJson("/api/campaigns", { method: "POST", body, token });
      toast?.(`Campaign started — ${valid.length} number${valid.length > 1 ? "s" : ""} queued`);
      onCreated?.(data.campaign);
    } catch (err) {
      toast?.(err.message || "Could not start campaign", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,24,38,0.40)", backdropFilter: "blur(2px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "16px", boxShadow: SHADOW_LG, width: "100%", maxWidth: "560px", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "13px", color: ACCENT, letterSpacing: "0.1em", fontWeight: 700 }}>📋 START BULK CAMPAIGN</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, fontSize: "18px", cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: "18px 20px", overflowY: "auto" }}>
          <div style={{ fontSize: "12px", color: MUTED, marginBottom: "16px", lineHeight: 1.6 }}>
            <b style={{ color: TEXT }}>{valid.length}</b> number{valid.length === 1 ? "" : "s"} selected{invalidCount > 0 && <span style={{ color: WARN }}> · {invalidCount} invalid will be skipped</span>}.
            The bot dials only inside your office-hours windows and retries missed/declined numbers.
          </div>

          <Field label="Campaign name">
            <input style={inp} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label="Default country / timezone" hint="Numbers without a country-specific rule below use this timezone for their office hours.">
            <select style={inp} value={defaultTz} onChange={(e) => setDefaultTz(e.target.value)}>
              {TIMEZONES.map((t) => <option key={t.tz} value={t.tz}>{t.label}</option>)}
            </select>
          </Field>

          <Field label="Calling time windows (default)" hint="The hours the bot is allowed to call, in the default timezone. Add more than one window for a split day (e.g. 10:00–13:00 and 15:00–18:00).">
            <WindowsEditor windows={defaultWindows} onChange={setDefaultWindows} />
          </Field>

          <Field label="Days the bot may call">
            <div style={{ display: "flex", gap: "6px" }}>
              {DAY_LABELS.map((d, i) => (
                <button key={i} onClick={() => setDays((p) => p.map((v, idx) => (idx === i ? !v : v)))}
                  style={{ ...btn(days[i] ? `${ACCENT}1A` : "transparent", days[i] ? ACCENT : MUTED, days[i] ? `${ACCENT}66` : BORDER), width: "38px", padding: "8px 0", textAlign: "center" }}>{d}</button>
              ))}
            </div>
          </Field>

          {/* Per-country overrides */}
          <Field label="Per-country office hours (optional)" hint="Give specific country codes their own timezone and windows — e.g. UK numbers dialed at UK hours, US numbers at US hours. Longest matching code wins.">
            {overrides.map((ov, i) => (
              <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "10px", marginBottom: "8px", background: BG }}>
                <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                  <select style={{ ...inp, flex: 1 }} value={ov.code}
                    onChange={(e) => { const opt = COUNTRY_OPTIONS.find((c) => c.code === e.target.value); setOverride(i, { code: e.target.value, tz: opt ? opt.tz : ov.tz }); }}>
                    {COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                  <button onClick={() => removeOverride(i)} style={{ ...btn("transparent", DANGER, BORDER), padding: "6px 10px" }}>✕</button>
                </div>
                <select style={{ ...inp, marginBottom: "8px" }} value={ov.tz} onChange={(e) => setOverride(i, { tz: e.target.value })}>
                  {TIMEZONES.map((t) => <option key={t.tz} value={t.tz}>{t.label}</option>)}
                </select>
                <WindowsEditor windows={ov.windows} onChange={(w) => setOverride(i, { windows: w })} />
              </div>
            ))}
            <button onClick={addOverride} style={{ ...btn("transparent", ACCENT, `${ACCENT}66`), padding: "6px 12px" }}>+ Add country rule</button>
          </Field>

          {/* Retry + pace */}
          <div style={{ display: "flex", gap: "10px" }}>
            <Field label="Retry after (min)" hint="Missed / declined">
              <input type="number" min="1" style={inp} value={retryDelayMinutes} onChange={(e) => setRetryDelayMinutes(e.target.value)} />
            </Field>
            <Field label="Max attempts" hint="Incl. first call">
              <input type="number" min="1" max="10" style={inp} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
            </Field>
            <Field label="Concurrency" hint="Calls at once">
              <input type="number" min="1" max="10" style={inp} value={concurrency} onChange={(e) => setConcurrency(e.target.value)} />
            </Field>
          </div>

          <div style={{ fontSize: "10px", color: MUTED, lineHeight: 1.6, background: `${INFO}0A`, border: `1px solid ${INFO}33`, borderRadius: "6px", padding: "10px 12px" }}>
            Uses your <b>Knowledge Base</b> and <b>Settings</b> (OpenAI/Twilio keys, language {settings.targetLang}, voice). Make sure your keys are set in ⚙ Settings, and the server has <code>PUBLIC_URL</code> configured.
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btn("transparent", MUTED, BORDER)}>Cancel</button>
          <button onClick={launch} disabled={busy} style={{ ...btn(ACCENT, ACCENT_TEXT, ACCENT), opacity: busy ? 0.6 : 1, cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? "Starting…" : `🚀 Launch (${valid.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── status / disposition badge ───────────────────────────────────────────────
function AttemptBadge({ a }) {
  let color = MUTED, label = "Queued", pulse = false;
  if (a.status === "calling") { color = INFO; label = "Calling…"; pulse = true; }
  else if (a.status === "queued") {
    const future = a.nextRunAt && new Date(a.nextRunAt).getTime() > Date.now();
    label = future ? `Scheduled · ${fmtTime(a.nextRunAt)}` : "Queued";
    color = future ? WARN : MUTED;
  } else {
    // terminal — show the disposition
    const map = {
      attended: [ACCENT, "✓ Attended"],
      missed: [WARN, "Missed"],
      declined: [DANGER, "Declined"],
      "do-not-call": [DANGER, "Do not call"],
      invalid: [MUTED, "Invalid number"],
    };
    const [c, l] = map[a.disposition] || [MUTED, a.status === "canceled" ? "Canceled" : "Done"];
    color = c; label = l;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "20px", color, background: `${color}14`, border: `1px solid ${color}44`, whiteSpace: "nowrap" }}>
      {pulse && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, animation: "pulse 1s infinite" }} />}
      {label}
    </span>
  );
}

function CountPill({ label, value, color }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "10px 14px", minWidth: "84px", boxShadow: SHADOW }}>
      <div style={{ fontSize: "20px", fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: "10px", letterSpacing: "0.08em", color: MUTED, textTransform: "uppercase", marginTop: "2px" }}>{label}</div>
    </div>
  );
}

// ── campaign detail (live) ───────────────────────────────────────────────────
function CampaignDetail({ id, token, onBack, toast }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const pollRef = useRef();

  async function load() {
    try { setData(await apiJson(`/api/campaigns/${id}`, { token })); setErr(""); }
    catch (e) { setErr(e.message || "Could not load campaign"); }
  }
  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 5000);
    return () => clearInterval(pollRef.current);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function action(verb) {
    try { await apiJson(`/api/campaigns/${id}/${verb}`, { method: "POST", token }); toast?.(`Campaign ${verb === "resume" ? "resumed" : verb + "d"}`); load(); }
    catch (e) { toast?.(e.message || "Action failed", "error"); }
  }

  if (err && !data) return <div style={{ padding: "40px", color: DANGER }}>{err} <button onClick={onBack} style={btn("transparent", MUTED, BORDER)}>Back</button></div>;
  if (!data) return <div style={{ padding: "40px", color: MUTED }}>Loading…</div>;

  const { campaign: c, attempts, counts } = data;
  const statusColor = c.status === "running" ? ACCENT : c.status === "paused" ? WARN : c.status === "completed" ? INFO : MUTED;

  return (
    <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button onClick={onBack} style={btn("transparent", MUTED, BORDER)}>← Campaigns</button>
        <div style={{ fontSize: "18px", fontWeight: 800, color: TEXT }}>{c.name}</div>
        <span style={{ fontSize: "11px", fontWeight: 700, color: statusColor, background: `${statusColor}14`, border: `1px solid ${statusColor}44`, borderRadius: "20px", padding: "3px 12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{c.status}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          {c.status === "running" && <button onClick={() => action("pause")} style={btn(`${WARN}14`, WARN, `${WARN}55`)}>⏸ Pause</button>}
          {c.status === "paused" && <button onClick={() => action("resume")} style={btn(`${ACCENT}14`, ACCENT, `${ACCENT}55`)}>▶ Resume</button>}
          {(c.status === "running" || c.status === "paused") && <button onClick={() => action("cancel")} style={btn(`${DANGER}14`, DANGER, `${DANGER}55`)}>⏹ Cancel</button>}
        </div>
      </div>

      {c.pausedReason && (
        <div style={{ fontSize: "12px", color: WARN, background: `${WARN}10`, border: `1px solid ${WARN}44`, borderRadius: "8px", padding: "10px 14px", marginBottom: "16px" }}>
          ⚠ Paused: {c.pausedReason}
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
        <CountPill label="Total" value={counts.total} color={TEXT} />
        <CountPill label="Attended" value={counts.attended} color={ACCENT} />
        <CountPill label="Missed" value={counts.missed} color={WARN} />
        <CountPill label="Declined" value={counts.declined} color={DANGER} />
        <CountPill label="Calling" value={counts.calling} color={INFO} />
        <CountPill label="Queued" value={counts.queued} color={MUTED} />
        <CountPill label="Done" value={counts.done} color={INFO} />
      </div>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", boxShadow: SHADOW, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1.2fr 0.6fr 2fr", gap: "10px", padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, fontSize: "10px", letterSpacing: "0.1em", color: MUTED, textTransform: "uppercase", fontWeight: 700 }}>
          <div>Name</div><div>Phone</div><div>Status</div><div>Tries</div><div>Last outcome</div>
        </div>
        {attempts.map((a) => (
          <div key={a.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1.2fr 0.6fr 2fr", gap: "10px", padding: "11px 16px", borderBottom: `1px solid ${BORDER}`, fontSize: "12px", color: TEXT, alignItems: "center" }}>
            <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name || "—"}</div>
            <div style={{ color: MUTED }}>{a.phone}{a.countryCode && <span style={{ marginLeft: "6px", fontSize: "10px", color: INFO }}>+{a.countryCode}</span>}</div>
            <div><AttemptBadge a={a} /></div>
            <div style={{ color: MUTED }}>{a.attempts}/{a.maxAttempts || c.maxAttempts}</div>
            <div style={{ color: MUTED, fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.lastSummary || ""}>
              {a.lastMeetingTime ? `📅 ${a.lastMeetingTime} · ` : ""}{a.lastSummary || "—"}
            </div>
          </div>
        ))}
        {!attempts.length && <div style={{ padding: "24px", textAlign: "center", color: MUTED, fontSize: "12px" }}>No numbers in this campaign.</div>}
      </div>
    </div>
  );
}

// ── campaigns list + router ──────────────────────────────────────────────────
export function CampaignsView({ token, onBack, toast, openId }) {
  const [list, setList] = useState(null);
  const [selected, setSelected] = useState(openId || null);
  const pollRef = useRef();

  async function load() {
    try { const d = await apiJson("/api/campaigns", { token }); setList(d.campaigns); }
    catch (e) { toast?.(e.message || "Could not load campaigns", "error"); setList([]); }
  }
  useEffect(() => {
    if (selected) return; // detail view handles its own polling
    load();
    pollRef.current = setInterval(load, 6000);
    return () => clearInterval(pollRef.current);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  if (selected) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: BG }}>
        <CampaignDetail id={selected} token={token} toast={toast} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", background: BG, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
        <button onClick={onBack} style={btn("transparent", MUTED, BORDER)}>← Dashboard</button>
        <div style={{ fontSize: "18px", fontWeight: 800 }}>📋 Bulk Campaigns</div>
        <button onClick={load} style={{ ...btn("transparent", ACCENT, `${ACCENT}55`), marginLeft: "auto" }}>↻ Refresh</button>
      </div>

      {list === null && <div style={{ color: MUTED, padding: "20px" }}>Loading…</div>}
      {list && list.length === 0 && (
        <div style={{ textAlign: "center", color: MUTED, padding: "60px 20px" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>📞</div>
          <div style={{ fontSize: "14px", color: TEXT, marginBottom: "6px" }}>No campaigns yet</div>
          <div style={{ fontSize: "12px" }}>Go back, tick some clients, and press <b style={{ color: ACCENT }}>Start Campaign</b>.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {(list || []).map((c) => {
          const statusColor = c.status === "running" ? ACCENT : c.status === "paused" ? WARN : c.status === "completed" ? INFO : MUTED;
          const done = c.counts.done, total = c.counts.total;
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <div key={c.id} onClick={() => setSelected(c.id)} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "12px", boxShadow: SHADOW, padding: "16px 18px", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: TEXT }}>{c.name}</div>
                <span style={{ fontSize: "10px", fontWeight: 700, color: statusColor, background: `${statusColor}14`, border: `1px solid ${statusColor}44`, borderRadius: "20px", padding: "2px 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{c.status}</span>
                <div style={{ marginLeft: "auto", fontSize: "11px", color: MUTED }}>{fmtTime(c.createdAt)}</div>
              </div>
              <div style={{ display: "flex", gap: "16px", fontSize: "11px", color: MUTED, marginBottom: "10px", flexWrap: "wrap" }}>
                <span>Total <b style={{ color: TEXT }}>{c.counts.total}</b></span>
                <span>Attended <b style={{ color: ACCENT }}>{c.counts.attended}</b></span>
                <span>Missed <b style={{ color: WARN }}>{c.counts.missed}</b></span>
                <span>Declined <b style={{ color: DANGER }}>{c.counts.declined}</b></span>
                <span>Queued <b style={{ color: TEXT }}>{c.counts.queued}</b></span>
                {c.counts.calling > 0 && <span>Calling <b style={{ color: INFO }}>{c.counts.calling}</b></span>}
              </div>
              <div style={{ height: "6px", borderRadius: "4px", background: BORDER, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: ACCENT }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
