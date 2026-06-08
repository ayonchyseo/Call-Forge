import { useState, useEffect } from "react";
import { apiJson } from "./api.js";
import {
  BG, CARD, BORDER, TEXT, MUTED, ACCENT, ACCENT_TEXT, WARN, DANGER, INFO,
  SHADOW, FONT, GLOBAL_CSS,
} from "./theme.js";

const STATUS_META = {
  pending: { label: "Pending", color: WARN },
  approved: { label: "Approved", color: ACCENT },
  rejected: { label: "Rejected", color: DANGER },
};

function Badge({ color, children }) {
  return (
    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: `${color}18`, color, border: `1px solid ${color}44`, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function btn(bg, color, border) {
  return {
    padding: "7px 13px", background: bg, border: `1px solid ${border}`, borderRadius: "9px",
    color, fontFamily: "inherit", fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  };
}

export default function AdminPanel({ user, onBack, onLogout }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiJson("/api/admin/users");
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || "Could not load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(id, fn) {
    setBusyId(id);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message || "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  const approve = (id) => act(id, () => apiJson(`/api/admin/users/${id}/approve`, { method: "POST" }));
  const reject = (id) => act(id, () => apiJson(`/api/admin/users/${id}/reject`, { method: "POST" }));
  const setRole = (id, role) => act(id, () => apiJson(`/api/admin/users/${id}/role`, { method: "POST", body: { role } }));
  const provision = (id) => act(id, () => apiJson(`/api/admin/users/${id}/provision`, { method: "POST" }));
  const remove = (id, email) => {
    if (!window.confirm(`Delete ${email}? They will lose access immediately.`)) return;
    act(id, () => apiJson(`/api/admin/users/${id}`, { method: "DELETE" }));
  };

  const counts = {
    pending: users.filter((u) => u.status === "pending").length,
    approved: users.filter((u) => u.status === "approved").length,
    total: users.length,
  };

  const pending = users.filter((u) => u.status === "pending");
  const others = users.filter((u) => u.status !== "pending");

  function row(u) {
    const isSelf = u.id === user.id;
    const created = u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
    return (
      <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", borderTop: `1px solid ${BORDER}`, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 220px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {u.email} {isSelf && <span style={{ color: MUTED, fontWeight: 600, fontSize: "12px" }}>(you)</span>}
          </div>
          <div style={{ fontSize: "12px", color: MUTED, marginTop: "2px" }}>Joined {created}</div>
        </div>
        <Badge color={u.role === "admin" ? INFO : MUTED}>{u.role === "admin" ? "Admin" : "Client"}</Badge>
        <Badge color={STATUS_META[u.status].color}>{STATUS_META[u.status].label}</Badge>
        {u.twilio && u.twilio.status !== "none" && (
          <Badge color={u.twilio.status === "active" ? ACCENT : u.twilio.status === "pending" ? WARN : DANGER}>
            {u.twilio.status === "active" ? `☎ ${u.twilio.phoneNumber}`
              : u.twilio.status === "pending" ? "☎ provisioning…"
              : "☎ provision failed"}
          </Badge>
        )}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end", flex: "1 1 auto" }}>
          {u.status === "pending" && (
            <button disabled={busyId === u.id} onClick={() => approve(u.id)} style={btn(ACCENT, ACCENT_TEXT, ACCENT)}>✓ Approve</button>
          )}
          {u.twilio?.status === "failed" && (
            <button disabled={busyId === u.id} onClick={() => provision(u.id)} title={u.twilio.error || "Retry Twilio number provisioning"} style={btn(`${WARN}12`, WARN, `${WARN}44`)}>
              ↻ Retry number
            </button>
          )}
          {u.status !== "rejected" && !isSelf && (
            <button disabled={busyId === u.id} onClick={() => reject(u.id)} style={btn(`${DANGER}12`, DANGER, `${DANGER}44`)}>
              {u.status === "pending" ? "✕ Decline" : "Revoke"}
            </button>
          )}
          {u.status === "rejected" && (
            <button disabled={busyId === u.id} onClick={() => approve(u.id)} style={btn(`${ACCENT}12`, ACCENT, `${ACCENT}44`)}>Re-approve</button>
          )}
          {u.status === "approved" && !isSelf && (
            <button disabled={busyId === u.id} onClick={() => setRole(u.id, u.role === "admin" ? "client" : "admin")} style={btn("transparent", INFO, `${INFO}44`)}>
              {u.role === "admin" ? "Make client" : "Make admin"}
            </button>
          )}
          {!isSelf && (
            <button disabled={busyId === u.id} onClick={() => remove(u.id, u.email)} style={btn("transparent", MUTED, BORDER)} title="Delete user">✕</button>
          )}
        </div>
      </div>
    );
  }

  const stat = (n, lbl, color) => (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "16px 20px", boxShadow: SHADOW, flex: 1, minWidth: "120px" }}>
      <div style={{ fontSize: "26px", fontWeight: 800, color }}>{n}</div>
      <div style={{ fontSize: "12px", color: MUTED, fontWeight: 600, marginTop: "2px" }}>{lbl}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: FONT }}>
      <style>{GLOBAL_CSS}</style>

      {/* Header */}
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, boxShadow: SHADOW, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            <span style={{ color: ACCENT }}>⬡</span> CallForge <span style={{ color: MUTED, fontWeight: 700 }}>· Admin</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px", color: MUTED, marginRight: "4px" }}>{user.email}</span>
          <button onClick={onBack} style={btn(`${ACCENT}12`, ACCENT, `${ACCENT}44`)}>← Dashboard</button>
          <button onClick={onLogout} style={btn("transparent", MUTED, BORDER)}>Log out</button>
        </div>
      </div>

      <div style={{ maxWidth: "920px", margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ fontSize: "22px", fontWeight: 800, marginBottom: "4px" }}>User management</div>
        <div style={{ fontSize: "13px", color: MUTED, marginBottom: "22px" }}>Approve new sign-ups and manage who can use the dashboard.</div>

        <div style={{ display: "flex", gap: "14px", marginBottom: "26px", flexWrap: "wrap" }}>
          {stat(counts.pending, "Awaiting approval", WARN)}
          {stat(counts.approved, "Approved users", ACCENT)}
          {stat(counts.total, "Total accounts", TEXT)}
        </div>

        {error && (
          <div style={{ fontSize: "13px", padding: "12px 14px", borderRadius: "10px", marginBottom: "18px", background: `${DANGER}12`, border: `1px solid ${DANGER}44`, color: DANGER }}>
            ✗ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", color: MUTED, padding: "60px 0", fontSize: "14px" }}>
            <span style={{ display: "inline-block", width: "20px", height: "20px", border: `2px solid ${ACCENT}33`, borderTop: `2px solid ${ACCENT}`, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            <div style={{ marginTop: "12px" }}>Loading users…</div>
          </div>
        ) : (
          <>
            {/* Pending first — the queue the admin acts on */}
            <div style={{ fontSize: "13px", fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
              Pending approval {pending.length > 0 && <span style={{ color: WARN }}>· {pending.length}</span>}
            </div>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", boxShadow: SHADOW, overflow: "hidden", marginBottom: "28px" }}>
              {pending.length === 0
                ? <div style={{ padding: "26px 18px", textAlign: "center", color: MUTED, fontSize: "13px" }}>🎉 No pending requests — you're all caught up.</div>
                : pending.map(row)}
            </div>

            <div style={{ fontSize: "13px", fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
              All accounts
            </div>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", boxShadow: SHADOW, overflow: "hidden" }}>
              {others.length === 0
                ? <div style={{ padding: "26px 18px", textAlign: "center", color: MUTED, fontSize: "13px" }}>No approved or rejected accounts yet.</div>
                : others.map(row)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
