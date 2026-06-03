import { useState } from "react";
import { apiJson } from "./api.js";
import {
  BG, CARD, BORDER, TEXT, MUTED, ACCENT, ACCENT_TEXT, DANGER, WARN, INFO,
  SHADOW_LG, FONT, GLOBAL_CSS,
} from "./theme.js";

const inp = {
  width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: "10px",
  color: TEXT, fontFamily: "inherit", fontSize: "14px", padding: "12px 14px",
  outline: "none", boxSizing: "border-box",
};
const label = { fontSize: "12px", fontWeight: 700, color: MUTED, marginBottom: "6px", display: "block" };

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");          // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);          // { type, text } success/info banner

  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice(null);
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        await apiJson("/api/auth/signup", { method: "POST", auth: false, body: { email, password } });
        setNotice({ type: "success", text: "Account created! An admin will approve it shortly — you'll be able to sign in once approved." });
        setMode("login");
        setPassword("");
      } else {
        const data = await apiJson("/api/auth/login", { method: "POST", auth: false, body: { email, password } });
        onLogin(data.token, data.user);
      }
    } catch (err) {
      // Pending/rejected come back as 403 with a friendly message.
      if (err.data?.status === "pending") setNotice({ type: "info", text: err.message });
      else setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(m) {
    setMode(m);
    setError("");
    setNotice(null);
  }

  const tab = (m, text) => (
    <button
      type="button"
      onClick={() => switchMode(m)}
      style={{
        flex: 1, padding: "10px", borderRadius: "10px", border: "none", cursor: "pointer",
        fontFamily: "inherit", fontSize: "13px", fontWeight: 700,
        background: mode === m ? CARD : "transparent",
        color: mode === m ? ACCENT : MUTED,
        boxShadow: mode === m ? "0 1px 3px rgba(16,24,40,0.10)" : "none",
      }}
    >
      {text}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <style>{GLOBAL_CSS}</style>

      <div style={{ width: "100%", maxWidth: "400px", animation: "fadeUp .3s ease" }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "22px" }}>
          <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.02em", color: TEXT }}>
            <span style={{ color: ACCENT }}>⬡</span> CallForge
          </div>
          <div style={{ fontSize: "13px", color: MUTED, marginTop: "6px" }}>
            AI cold-calling, scripts &amp; lead tracking
          </div>
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "18px", boxShadow: SHADOW_LG, padding: "26px" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: "4px", background: BG, padding: "4px", borderRadius: "12px", marginBottom: "22px" }}>
            {tab("login", "Sign in")}
            {tab("signup", "Create account")}
          </div>

          {notice && (
            <div style={{
              fontSize: "13px", lineHeight: 1.6, padding: "12px 14px", borderRadius: "10px", marginBottom: "16px",
              background: notice.type === "success" ? `${ACCENT}14` : `${INFO}14`,
              border: `1px solid ${notice.type === "success" ? ACCENT : INFO}44`,
              color: notice.type === "success" ? ACCENT : INFO,
            }}>
              {notice.type === "success" ? "✓ " : "⏳ "}{notice.text}
            </div>
          )}
          {error && (
            <div style={{ fontSize: "13px", lineHeight: 1.6, padding: "12px 14px", borderRadius: "10px", marginBottom: "16px", background: `${DANGER}12`, border: `1px solid ${DANGER}44`, color: DANGER }}>
              ✗ {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div style={{ marginBottom: "16px" }}>
              <label style={label}>Email</label>
              <input style={inp} type="email" value={email} autoComplete="email"
                onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={label}>Password</label>
              <input style={inp} type="password" value={password}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"} />
            </div>

            <button type="submit" disabled={busy}
              style={{
                width: "100%", padding: "13px", borderRadius: "11px", border: "none",
                background: ACCENT, color: ACCENT_TEXT, fontFamily: "inherit", fontSize: "14px", fontWeight: 800,
                cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1,
                boxShadow: `0 6px 16px ${ACCENT}44`,
              }}>
              {busy ? (mode === "signup" ? "Creating…" : "Signing in…") : (mode === "signup" ? "Create account" : "Sign in")}
            </button>
          </form>

          {mode === "signup" && (
            <div style={{ fontSize: "12px", color: MUTED, lineHeight: 1.6, marginTop: "14px", textAlign: "center" }}>
              New accounts need admin approval before first sign-in.
            </div>
          )}

        </div>

        <div style={{ textAlign: "center", fontSize: "11px", color: MUTED, marginTop: "18px", lineHeight: 1.6 }}>
          ⚠ AI cold-calling is regulated. Confirm consent rules before live calls.
        </div>
      </div>
    </div>
  );
}
