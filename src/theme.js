// CallForge — shared visual theme.
// Crisp, high-contrast, modern. Inter type, deep-indigo accent, near-black text.

export const BG = "#F4F5F7";          // app canvas (off-white)
export const CARD = "#FFFFFF";        // cards / surfaces
export const BORDER = "#E4E7EE";      // hairline borders
export const TEXT = "#0B0D14";        // primary text (near-black)
export const MUTED = "#4D5666";       // secondary text (dark slate — readable, not dull)
export const ACCENT = "#4F46E5";      // indigo — primary actions
export const ACCENT_TEXT = "#FFFFFF"; // text on accent/colored buttons
export const WARN = "#D97706";        // amber
export const DANGER = "#DC2626";      // red
export const INFO = "#2563EB";        // blue — AI / informational

export const SHADOW = "0 1px 2px rgba(11,13,20,0.05), 0 2px 6px rgba(11,13,20,0.07)";
export const SHADOW_LG = "0 18px 44px rgba(11,13,20,0.16), 0 4px 14px rgba(11,13,20,0.08)";

export const FONT = "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
export const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');";

// Global CSS shared by every screen (auth, dashboard, admin).
export const GLOBAL_CSS = `
  ${FONT_IMPORT}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${BG}; color: ${TEXT}; }
  body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #C7CCD8; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #AEB4C2; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  @keyframes slideIn { from { transform: translateX(20px); opacity:0; } to { transform:none; opacity:1; } }
  @keyframes fadeUp { from { transform: translateY(8px); opacity:0; } to { transform:none; opacity:1; } }
  button { transition: opacity .15s, transform .05s, box-shadow .15s, background .15s, border-color .15s; }
  button:hover { opacity: 0.92; }
  button:active { transform: translateY(1px); }
  input::placeholder, textarea::placeholder { color: ${MUTED}; opacity: 0.65; }
  input:focus, textarea:focus, select:focus { border-color: ${ACCENT} !important; box-shadow: 0 0 0 3px ${ACCENT}22; }
`;
