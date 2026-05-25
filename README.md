# ⬡ CallForge — AI Cold Calling System

An AI-powered cold calling assistant that generates personalized Bangla call scripts and tracks leads.

## Features

- 📋 **Client Management** — Upload clients via CSV or add manually
- 🤖 **AI Script Generation** — Generates personalized Bangla call scripts per client using Claude AI
- 📞 **Call Tracking** — Mark calls in progress, add notes
- 📊 **Lead Status** — Track: Lead ✓ / Follow-up ↺ / Not Interested ✗
- 📈 **Live Stats** — See conversion counts at a glance
- 🤖 **AI Auto-Calling (proof-of-concept)** — An AI agent dials the number, holds a Bangla conversation, books a meeting, and logs the lead automatically (see below)

## AI Auto-Calling (proof-of-concept)

The **🤖 AI Call** button doesn't just open the dialer — it triggers an autonomous
AI agent that *calls the number itself*, talks to the prospect in Bangla, tries to
book a meeting, and writes the outcome (lead status + meeting time + transcript)
back into the client record. Then the existing **↓ Export** button hands you an
Excel/CSV with all of it.

This needs a small backend (`server/`) plus a voice provider. We use
[Vapi](https://vapi.ai), which bundles telephony + Bangla speech-to-text/text-to-speech
+ the LLM, so the backend stays tiny. Free trial credits are enough to test it.

> ⚠️ **Not yet tested against live telephony.** The code path is complete, but a
> real call needs your own Vapi account + phone number, and Bangla voice quality
> should be validated on a test call before relying on it.

### Setup

```bash
npm install
cp server/.env.example server/.env   # then fill in VAPI_API_KEY + VAPI_PHONE_NUMBER_ID
npm run server                       # starts the AI-call backend on :8787
npm run dev                          # starts the frontend (separate terminal)
```

For the AI to report results back, Vapi needs a public webhook URL. Locally,
run `ngrok http 8787` and set `PUBLIC_URL` in `server/.env` to the https URL.
Without it you can still see results in the Vapi dashboard.

The frontend talks to `http://localhost:8787` by default; override with
`VITE_API_URL` if you host the backend elsewhere.

## Tech Stack

- React 18 + Vite
- Anthropic Claude API (claude-sonnet-4-20250514)
- Core app needs no backend; AI auto-calling adds an optional Node/Express + Vapi backend

## Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/callforge.git
cd callforge
```

### 2. Install dependencies
```bash
npm install
```

### 3. Add your Anthropic API key

The app uses the Anthropic API. By default it relies on the Claude.ai artifact environment which handles auth automatically.

For standalone use, create a `.env` file:
```
VITE_ANTHROPIC_API_KEY=your_api_key_here
```

Then update the fetch call in `src/App.jsx`:
```js
headers: {
  "Content-Type": "application/json",
  "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
}
```

### 4. Run locally
```bash
npm run dev
```

### 5. Build for production
```bash
npm run build
```

## CSV Format

Upload a `.csv` file with these columns:

```
name,phone,contact,industry
ABC Company,01711-111111,Mr. Alam,Retail
XYZ Ltd,01812-222222,Ms. Mitu,Healthcare
```

## License

MIT
