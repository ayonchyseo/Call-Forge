# ⬡ CallForge — AI Cold Calling System

An AI-powered cold-calling assistant that writes personalized **English** call scripts,
lets an AI agent place the call for you, and tracks every lead — built for outbound
calling to the **US, UK, AU, and NZ**.

> You describe your business in **any language** (Bangla, Spanish, Arabic, Hindi, …)
> and CallForge produces a clean **English** script and runs the call in English.

## Features

- 📋 **Client Management** — Upload clients via CSV or add them manually
- 🌐 **Any-language → English scripts** — Enter your business info in any language; CallForge writes a structured English cold-call script. Works offline too via a built-in English template engine.
- 📞 **Manual Calling** — Tap-to-dial (`tel:`) with a call timer and notes
- 🤖 **AI Auto-Calling** — An AI agent dials the number itself, holds an English conversation, tries to book a meeting, and logs the outcome (see below)
- 📊 **Lead Status & Live Stats** — Track Lead ✓ / Follow-up ↺ / Declined ✗ with at-a-glance conversion counts
- ↓ **Export** — Download all clients, statuses, and notes as CSV

## How script generation works

When the **AI backend** is running with an `OPENAI_API_KEY`, the **⚡ Generate Script**
button sends your business info to a cheap `gpt-4o-mini` call that **translates any input
language into a professional English script**. If the backend is unreachable, it
automatically falls back to a fully offline English template engine — so the app always
produces a usable script.

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

### 3. Configure the AI backend (for English AI scripts + real calls)
```bash
cp server/.env.example server/.env   # fill in your keys (see below)
ngrok http 8787                       # gives a public https URL for Twilio
# put that https URL into PUBLIC_URL in server/.env
npm run server                        # AI backend on :8787
```

All keys live in `server/.env` (never in the browser):

| Variable | Needed for | Notes |
|---|---|---|
| `OPENAI_API_KEY` | AI scripts **and** calls | https://platform.openai.com/api-keys |
| `TWILIO_ACCOUNT_SID` | calls | https://console.twilio.com |
| `TWILIO_AUTH_TOKEN` | calls | |
| `TWILIO_FROM_NUMBER` | calls | your Twilio voice number, E.164 e.g. `+15551234567` |
| `PUBLIC_URL` | calls | public https URL Twilio can reach (e.g. ngrok) |

Hit `http://localhost:8787/api/health` to see what's still missing. Only
`OPENAI_API_KEY` is required for AI script generation; the full set is needed for calls.

The frontend talks to `http://localhost:8787` by default; override with `VITE_API_URL`.

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
