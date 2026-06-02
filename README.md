# ⬡ CallForge — AI Cold Calling System

An AI-powered cold-calling assistant that writes personalized **English** call scripts,
lets an AI agent place the call for you, and tracks every lead — built for outbound
calling to the **US, UK, AU, and NZ**.

> You describe your business in **any language** (Bangla, Spanish, Arabic, Hindi, …)
> and CallForge produces a clean **English** script and runs the call in English.

## Features

- 📋 **Client Management** — Upload clients via CSV or add them manually
- 🌐 **Any-language → your-language scripts** — Enter business info in any language; CallForge writes a structured script in the language you pick. Works offline too via a built-in template engine.
- ⚙ **In-app Settings** — Save your OpenAI/Twilio keys, target language, AI call instructions, and backend URL right in the browser (no `.env` editing required).
- 📞 **Manual Calling** — Tap-to-dial (`tel:`) with a call timer and notes
- 🤖 **AI Auto-Calling** — An AI agent dials the number itself, holds the conversation, tries to book a meeting, and logs the outcome (see below)
- 📊 **Lead Status & Live Stats** — Track Lead ✓ / Follow-up ↺ / Declined ✗ with at-a-glance conversion counts
- ↓ **Export** — Download all clients, statuses, and notes as CSV
- ❓ **Built-in Help** — A "How to use" guide is one click away in the header

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

Per-request keys from Settings take priority over `server/.env`. `PUBLIC_URL` is the one
value only the backend can provide. Hit `http://localhost:8787/api/health` to check config.

The frontend uses the **Backend URL** from Settings (or `VITE_API_URL`, default
`http://localhost:8787`).

### Deploying the backend (required for live AI calls)

A static site (e.g. Vercel) **cannot place phone calls** — Twilio must stream call audio
to a long-running server with a public websocket. Deploy `server/index.js` to any host
that runs Node and keeps a process alive (Render, Railway, Fly.io, a VPS, …):

1. Deploy the repo; start command `npm run server` (or `node server/index.js`).
2. Set `PUBLIC_URL` to the service's public **https** URL (no trailing slash).
3. In the app's **⚙ Settings**, set **Backend URL** to that same URL and add your
   OpenAI + Twilio keys.

The frontend can stay on Vercel; it just needs to point at this backend for AI calls.

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
