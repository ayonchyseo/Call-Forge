# ⬡ CallForge — AI Cold Calling System

An AI-powered cold-calling assistant that writes personalized **English** call scripts,
lets an AI agent place the call for you, and tracks every lead — built for outbound
calling to the **US, UK, AU, and NZ**.

> You describe your business in **any language** (Bangla, Spanish, Arabic, Hindi, …)
> and CallForge produces a clean **English** script and runs the call in English.

## Features

- 🔐 **Accounts & admin approval** — Users sign up with email + password, then an **admin approves** them before they can sign in (no email verification needed). Admins get a built-in user-management panel.
- 📋 **Client Management** — Upload clients via CSV or add them manually
- 🌐 **Any-language → your-language scripts** — Enter business info in any language; CallForge writes a structured script in the language you pick. Works offline too via a built-in template engine.
- ⚙ **In-app Settings** — Save your OpenAI/Twilio keys, target language, AI call instructions, and backend URL right in the browser (no `.env` editing required).
- 📞 **Manual Calling** — Tap-to-dial (`tel:`) with a call timer and notes
- 🤖 **AI Auto-Calling** — An AI agent dials the number itself, holds the conversation, tries to book a meeting, and logs the outcome (see below)
- 📊 **Lead Status & Live Stats** — Track Lead ✓ / Follow-up ↺ / Declined ✗ with at-a-glance conversion counts
- ↓ **Export** — Download all clients, statuses, and notes as CSV
- ❓ **Built-in Help** — A "How to use" guide is one click away in the header

## Accounts & admin approval

CallForge is gated behind a login. The flow is deliberately simple — **no email
verification**; an admin manually approves each new account:

1. A new user opens the app and **creates an account** (email + password).
2. The account starts as **`pending`** — they can't sign in yet.
3. An **admin** opens the **◇ Admin** panel (top-right) and clicks **✓ Approve**.
4. The user can now **sign in** and use the dashboard.

Admins can also decline, re-approve, promote/demote (client ↔ admin), or delete users.

### First admin

On first start the server **ensures one admin exists** so you can approve everyone else.
Set these on the server (Render dashboard, `server/.env`, etc.):

| Variable | Default | Notes |
|---|---|---|
| `ADMIN_EMAIL` | `admin@callforge.app` | The seeded admin's login email |
| `ADMIN_PASSWORD` | `changeme123` | **Change this** — set a strong password before going live |

If you don't set them, a default admin is created and its credentials are printed in
the server logs on first boot. Log in as that admin, then create/approve real accounts.

### Where accounts are stored (durability)

The accounts layer works two ways automatically:

| Mode | When | Durability |
|---|---|---|
| **Postgres** | `DATABASE_URL` is set | ✅ Durable — survives redeploys. **Use this in production.** |
| **JSON file** | no `DATABASE_URL` | ⚠️ Stored at `server/data/users.json`. Fine for local/dev, but **wiped on every redeploy** on hosts like Render. |

For a real, sellable deployment, create a free Postgres database (Neon, Supabase, Render
Postgres, …) and set `DATABASE_URL` — approved accounts will then persist. Also set
`JWT_SECRET` to a long random string so logins survive restarts.

> Client data (clients, scripts, notes, API keys) is currently stored **per-account in the
> browser** (namespaced by user), so each approved user manages their own list on their own
> device. Moving this data server-side per account is a natural next step.

## How script generation works

With an **OpenAI key in ⚙ Settings**, the **⚡ Generate Script** button calls a cheap
`gpt-4o-mini` model **directly from your browser** (no backend needed) that **translates any
input language into a professional script in your chosen language**. With no key set, it
automatically falls back to a fully offline template engine — so the app always produces a
usable script. (If you'd rather keep the key on a server, the backend exposes the same
`/api/generate-script`.)

## AI Auto-Calling (Twilio + OpenAI only — no Vapi)

The **🤖 AI Call** button triggers an autonomous agent that *calls the number itself*,
talks to the prospect in English, tries to book a meeting, and writes the outcome
(lead status + meeting time + transcript) back into the client record.

**Only two services are used: Twilio + OpenAI.** No third-party voice platform.

- **Twilio** places the outbound call from your own number and streams the audio.
- **OpenAI Realtime API** listens, thinks, and speaks (speech-to-speech) over that
  stream; a cheap `gpt-4o-mini` call afterward extracts the lead/meeting details.

Lowest-cost defaults are used (`gpt-4o-mini-realtime` for the call, `gpt-4o-mini`
for analysis). Rough cost ≈ Twilio per-minute (varies by country) + OpenAI realtime
audio minutes.

**Reliability built in:** Twilio status callbacks mean a no-answer / busy / failed call
ends cleanly (no infinite spinner), a max-duration cap auto-hangs-up stuck calls so they
can't run up charges, and barge-in lets the prospect interrupt the agent naturally.

> ⚠️ **Compliance:** automated/AI cold calls to the US, UK, AU, and NZ are regulated
> (e.g. TCPA, AI-disclosure and do-not-call rules). Confirm consent and disclosure
> requirements before running real campaigns. Test on your own number first.

## Tech Stack

- React 18 + Vite (frontend)
- Node + Express + `ws` (optional AI-call/script backend)
- OpenAI Realtime API (live call) + `gpt-4o-mini` (script generation & analysis)
- Twilio Programmable Voice (telephony)

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Run the frontend (no backend needed for the CRM + offline scripts)
```bash
npm run dev
```
The app runs at the URL Vite prints. Script generation falls back to the offline
English template engine until the backend is configured.

### 3. Add your keys — two ways

**A) In the app (⚙ Settings) — easiest, works with the hosted frontend.**
Open **⚙ Settings** and paste your **OpenAI key**, **Twilio** keys, your **backend URL**,
pick a **language**, and add any **AI call instructions**. Keys are stored only in your
browser (localStorage) and sent directly to OpenAI / your backend.
- With just an **OpenAI key**, AI script generation runs **directly in the browser** — no
  backend required (great for a Vercel-hosted frontend).
- For **live AI calls** you also need Twilio keys **and** a deployed backend URL (below).

**B) On the server (`server/.env`) — for self-hosting everything.**
```bash
cp server/.env.example server/.env   # fill in your keys
ngrok http 8787                       # public https URL for Twilio
# put that https URL into PUBLIC_URL in server/.env
npm run server                        # backend on :8787
```

| Variable | Needed for | Notes |
|---|---|---|
| `OPENAI_API_KEY` | AI scripts + calls | https://platform.openai.com/api-keys (or enter in Settings) |
| `TWILIO_ACCOUNT_SID` | calls | https://console.twilio.com (or enter in Settings) |
| `TWILIO_AUTH_TOKEN` | calls | |
| `TWILIO_FROM_NUMBER` | calls | your Twilio voice number, E.164 e.g. `+15551234567` |
| `PUBLIC_URL` | calls | public https URL Twilio can reach — **must be set on the server** |
| `DATABASE_URL` | durable accounts | Postgres connection string. Without it, accounts use an ephemeral file. **Set in production.** |
| `JWT_SECRET` | login sessions | long random string so logins survive restarts |
| `ADMIN_EMAIL` | first admin | seeded admin login (default `admin@callforge.app`) |
| `ADMIN_PASSWORD` | first admin | seeded admin password — **change it** (default `changeme123`) |

Per-request keys from Settings take priority over `server/.env`. `PUBLIC_URL` is the one
value only the backend can provide. Hit `http://localhost:8787/api/health` to check config.

The frontend uses the **Backend URL** from Settings (or `VITE_API_URL`, default
`http://localhost:8787`).

### Deploying the backend (required for live AI calls)

A static site (e.g. Vercel) **cannot place phone calls** — Twilio must stream call audio
to a long-running server with a public websocket. This repo ships ready-to-deploy configs:

- **`render.yaml`** — one-click [Render](https://render.com) Blueprint that deploys the
  **whole app** (UI + backend) at one URL. `PUBLIC_URL` is auto-detected. *Recommended.*
- **`Dockerfile`** — single container for Fly.io / Railway / a VPS.
- **`Procfile`** — for Railway / Heroku-style hosts.

**👉 Full click-by-click instructions (Render, Vercel+backend, local ngrok, Docker) and
the "what to do on your end" checklist are in [`DEPLOY.md`](./DEPLOY.md).**

### 4. Single-command production run
```bash
npm run build      # build the frontend into dist/
npm run server     # backend now also serves the built UI on :8787
```
Open `http://localhost:8787`.

## CSV Format

Upload a `.csv` with these columns (phone in full international/E.164 format for AI calls):

```
name,phone,contact,industry
Summit Retail Co,+14155550142,Sarah Mitchell,Retail
Orbit Logistics,+442079460958,James Carter,Logistics
```

## License

MIT
