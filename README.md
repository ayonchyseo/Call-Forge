# ⬡ CallForge — AI Cold Calling System

An AI-powered cold calling assistant that generates personalized Bangla call scripts and tracks leads.

## Features

- 📋 **Client Management** — Upload clients via CSV or add manually
- 🤖 **AI Script Generation** — Generates personalized Bangla call scripts per client using Claude AI
- 📞 **Call Tracking** — Mark calls in progress, add notes
- 📊 **Lead Status** — Track: Lead ✓ / Follow-up ↺ / Not Interested ✗
- 📈 **Live Stats** — See conversion counts at a glance

## Tech Stack

- React 18 + Vite
- Anthropic Claude API (claude-sonnet-4-20250514)
- No backend required

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
