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
AI agent that *calls the number itself*, talks to the prospect in English, tries to
book a meeting, and writes the outcome (lead status + meeting time + transcript)
back into the client record. Then the existing **↓ Export** button hands you an
Excel/CSV with all of it. Built for outbound calling to the US, UK, AU, and NZ.

**Only two services are used: Twilio + OpenAI.** No other voice platform.
- **Twilio** places the outbound call from your own number and streams the audio.
- **OpenAI Realtime API** listens, thinks, and speaks (speech-to-speech) over that
  stream; a cheap `gpt-4o-mini` call afterward extracts the lead/meeting details.

Lowest-cost defaults are used (`gpt-4o-mini-realtime` for the call, `gpt-4o-mini`
for analysis). Rough cost ≈ Twilio per-minute (varies by country) + OpenAI realtime
audio minutes.

### Go live — no terminal needed (deploy to Render)

This repo includes a `render.yaml`, so the dashboard + calling backend deploy as
one live URL with no commands and no ngrok.

1. Get an **OpenAI API key** → https://platform.openai.com/api-keys
2. In **Twilio** (https://console.twilio.com): buy a voice-capable number, and copy
   your **Account SID** and **Auth Token** from the dashboard.
3. Push this repo to GitHub, then on **Render** (https://render.com): *New → Blueprint*,
   connect the repo. When prompted, paste the four secrets:
   `OPENAI_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
4. Deploy. Render gives you a public `https://...onrender.com` URL — that's your
   **live dashboard** (the calling backend runs at the same URL; `PUBLIC_URL` is set
   automatically). Open it, pick a client, hit **🤖 AI Call**.

Visit `https://your-app.onrender.com/api/health` to confirm everything is configured.
API keys live only on the server (set in Render), never in the browser.

### Run locally instead (optional, needs a terminal)

```bash
npm install
cp server/.env.example server/.env   # fill in OpenAI + Twilio keys
ngrok http 8787                       # gives a public https URL for Twilio
# put that https URL into PUBLIC_URL in server/.env
npm run build && npm run server       # dashboard + backend on :8787
```

> ⚠️ **Not yet tested against live telephony.** The full Twilio↔OpenAI bridge is
> implemented, but a real call needs your own Twilio number + OpenAI key, and you
> should validate it on a test call first.
>
> ⚠️ **Compliance:** automated/AI cold calls to the US, UK, AU, and NZ are
> regulated (e.g. TCPA, AI-disclosure and do-not-call rules). Confirm consent
> and disclosure requirements before running real campaigns.

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
- Core app needs no backend; AI auto-calling adds an optional Node/Express backend (Twilio + OpenAI Realtime)

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
