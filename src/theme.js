// CallForge — shared visual theme.
// Light, off-white, minimal. Rounded "Nunito" type, indigo accent, soft shadows.

export const BG = "#F4F5F7";          // app canvas (off-white)
export const CARD = "#FFFFFF";        // cards / surfaces
export const BORDER = "#E7E9EE";      // hairline borders
export const TEXT = "#1E2230";        // primary text
export const MUTED = "#8A90A0";       // secondary text
export const ACCENT = "#6366F1";      // indigo — primary actions
export const ACCENT_TEXT = "#FFFFFF"; // text on accent/colored buttons
export const WARN = "#F59E0B";        // amber
export const DANGER = "#EF4444";      // red
export const INFO = "#3B82F6";        // blue — AI / informational

export const SHADOW = "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)";
export const SHADOW_LG = "0 12px 32px rgba(16,24,40,0.14), 0 2px 8px rgba(16,24,40,0.06)";

export const FONT = "'Nunito', system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
export const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');";

// Global CSS shared by every screen (auth, dashboard, admin).
export const GLOBAL_CSS = `
  ${FONT_IMPORT}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${BG}; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #D7DAE2; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #C3C7D2; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  @keyframes slideIn { from { transform: translateX(20px); opacity:0; } to { transform:none; opacity:1; } }
  @keyframes fadeUp { from { transform: translateY(8px); opacity:0; } to { transform:none; opacity:1; } }
  button { transition: opacity .15s, transform .05s, box-shadow .15s, background .15s, border-color .15s; }
  button:hover { opacity: 0.9; }
  button:active { transform: translateY(1px); }
  input::placeholder, textarea::placeholder { color: ${MUTED}; }
  input:focus, textarea:focus, select:focus { border-color: ${ACCENT} !important; box-shadow: 0 0 0 3px ${ACCENT}22; }
`;
