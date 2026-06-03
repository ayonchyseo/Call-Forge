// CallForge — tiny API + auth client shared by every screen.
//
// Backend URL resolution:
//   • Default = same origin in production (one Render service serves UI + API),
//     or localhost:8787 in dev. Override at build time with VITE_API_URL.
//   • A global `cf_backend` localStorage key lets users point a separately-hosted
//     UI at their backend (set from the login screen's "Advanced" field or Settings).
//
// Token: a JWT kept in localStorage under `cf_token`.

export const DEFAULT_API =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:8787" : "");

const stripSlash = (u) => (u || "").trim().replace(/\/+$/, "");

export function getApiBase() {
  try {
    const v = stripSlash(localStorage.getItem("cf_backend"));
    if (v) return v;
  } catch { /* ignore */ }
  return DEFAULT_API;
}

export function setApiBase(url) {
  try {
    const v = stripSlash(url);
    if (v) localStorage.setItem("cf_backend", v);
    else localStorage.removeItem("cf_backend");
  } catch { /* ignore */ }
}

export function getToken() {
  try { return localStorage.getItem("cf_token") || ""; } catch { return ""; }
}

export function setToken(t) {
  try {
    if (t) localStorage.setItem("cf_token", t);
    else localStorage.removeItem("cf_token");
  } catch { /* ignore */ }
}

// fetch wrapper: prepends the backend base and attaches the bearer token.
export async function apiFetch(path, { method = "GET", body, token, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const t = token ?? getToken();
  if (auth && t) headers.Authorization = `Bearer ${t}`;
  return fetch(getApiBase() + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// Convenience: POST/GET that parse JSON and throw the server's error message.
export async function apiJson(path, opts = {}) {
  const res = await apiFetch(path, opts);
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
