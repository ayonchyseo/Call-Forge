# Deploying CallForge — and what you do on your end

CallForge has two parts:

- a **frontend** (the UI) — static, can live anywhere (Vercel, or the backend can serve it)
- a **backend** (`server/index.js`) — an always-on Node server that bridges **Twilio**
  (the phone line) and **OpenAI** (the voice/brain). **Live AI calls need this backend.**

Everything *except* live AI calls (clients, CSV, notes, manual dial, and AI **script
generation** with your OpenAI key) works with no backend at all.

---

## ✅ What you need on your end (one-time)

1. **OpenAI API key** — https://platform.openai.com/api-keys
   - A paid OpenAI account (Realtime voice + `gpt-4o-mini` are pay-as-you-go).
2. **Twilio account + a voice phone number** — https://console.twilio.com
   - Buy a voice-capable number (a few dollars/month).
   - Copy your **Account SID** and **Auth Token** from the console dashboard.
   - ⚠️ **Trial accounts can only call numbers you've "verified"** in Twilio, and play a
     trial notice. To call any number, add funds / upgrade.
3. A place to run the backend (pick one path below).

---

## 🚀 Path A — One service on Render (recommended, simplest)

This deploys the **whole app** (UI + backend) at one URL. No Vercel needed.

1. Push this repo to **GitHub**.
2. Go to **https://render.com → New → Blueprint**, pick this repo. Render reads
   `render.yaml` and configures everything (build, start, health check, Node 22).
3. Click **Apply** and wait for the first deploy (a few minutes).
4. Open the service URL it gives you, e.g. `https://callforge.onrender.com` — **that's
   your live app.**
5. In the app: **⚙ Settings** → paste your **OpenAI key**, **Twilio SID / Auth Token /
   From number**, pick a **language**, add any **AI call instructions** → **Save**.
   - Leave **Backend URL blank** — the app talks to itself (same URL).
6. Add a client with a real **+E.164** number, click **🤖 AI Call**.

`PUBLIC_URL` is set automatically on Render — you don't touch it.

> Free tier note: the service **sleeps after ~15 min idle** and cold-starts on the next
> request, which can delay the first call. For real use, upgrade to a paid instance.

---

## 🌐 Path B — Keep your Vercel frontend + Render backend

If you want to keep the frontend on Vercel:

1. **Frontend (Vercel):** it already builds with Vite (`npm run build`, output `dist`).
   No changes needed. Make sure Vercel deploys the branch with these updates.
2. **Backend (Render):** do Path A steps 1–4 to get a backend URL
   (e.g. `https://callforge.onrender.com`).
3. On your **Vercel app → ⚙ Settings**, set **Backend URL** to that Render URL, and add
   your OpenAI + Twilio keys → Save.

(Your browser calls the Render backend cross-origin; CORS is already enabled on it.)

---

## 🧪 Path C — Test locally first (free, 5 minutes)

```bash
npm install
npm run server                 # backend on http://localhost:8787
# in a second terminal:
ngrok http 8787                # prints a public https URL
```
- Put the **ngrok https URL** in `PUBLIC_URL`: `cp server/.env.example server/.env`,
  set `PUBLIC_URL=https://<id>.ngrok-free.app`, restart `npm run server`.
- In a third terminal run the UI: `npm run dev`, open it, and in **⚙ Settings** set
  **Backend URL** to the ngrok URL + add your keys.
- `ngrok` tunnels the public internet to your laptop so Twilio can reach it. Closing
  ngrok ends the tunnel.

---

## 🐳 Path D — Docker (Fly.io / Railway / VPS)

```bash
docker build -t callforge .
docker run -p 8787:8787 -e PUBLIC_URL=https://your-public-https-url callforge
```
- `PUBLIC_URL` must be the container's **public** https URL (not localhost).
- On Railway: it auto-builds (Procfile/Nixpacks); set `PUBLIC_URL` to the public domain
  Railway assigns.
- On Fly.io: `fly launch` uses the `Dockerfile`; set `PUBLIC_URL` to your `*.fly.dev` URL.

---

## 🔎 Check it's configured

Open `https://<your-backend>/api/health`:
```json
{ "ok": true, "publicUrl": true, "hasServerOpenAI": false, "hasServerTwilio": false }
```
- `publicUrl: true` → the backend knows its public URL (good).
- The `hasServer*` flags are about server-side env keys; they can be `false` if you
  entered keys in the app's Settings instead (that's fine).

## Make a test call
1. Add a client whose phone is your **own** number, in full international format
   (`+1...`, `+44...`). On a Twilio trial, verify that number first.
2. **🤖 AI Call** → your phone rings → the AI greets you → talk to it.
3. Watch the live status + transcript in the app; the outcome is saved to the client.

## ⚠️ Compliance
Automated/AI cold calls are regulated (TCPA in the US, plus AI-disclosure and
do-not-call rules in the UK/AU/NZ). Get consent where required, disclose the AI, honor
do-not-call lists, and test on your own number before any campaign.
