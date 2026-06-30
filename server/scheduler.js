// CallForge — bulk-calling scheduler + timezone-aware office-hours engine.
//
// This is the brain of bulk/scheduled calling. It runs ON THE SERVER (so a
// campaign keeps dialing even when the user's browser is closed) and every
// minute it:
//   1. looks at each RUNNING campaign,
//   2. finds numbers that are DUE and currently INSIDE their allowed calling
//      window (respecting per-country timezones + multiple daily windows),
//   3. dials up to the campaign's concurrency limit via the same Twilio+OpenAI
//      path the single-call button uses,
//   4. on each outcome, classifies it (attended / missed / declined / …) and —
//      for missed/declined — schedules a retry at +2h, re-clamped back into the
//      office-hours window, up to the campaign's max attempts.
//
// Numbers that can't be reached before a window closes are simply not dialed
// until the next window opens — which is exactly the "roll over to the next
// day" behaviour, handled for free by the window gate.
//
// The store (campaigns.js) and the call-placing function (placeCall, from
// index.js) are INJECTED via start() so this module has no circular imports.

// ── timezone helpers (dependency-free, via Intl) ────────────────────────────
// We deliberately avoid moment/luxon to keep the dependency surface tiny. All
// timezone math is done with Intl.DateTimeFormat, which is built into Node.

// Wall-clock parts of an instant, AS SEEN in a given IANA timezone.
// Returns { year, month(1-12), day, hour(0-23), minute, weekday(0=Sun..6=Sat) }.
export function getZonedParts(date, tz) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  // Intl can emit "24" for midnight in hour12:false mode — normalise to 0.
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0;
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour,
    minute: parseInt(map.minute, 10),
    weekday: WD[map.weekday] ?? 0,
  };
}

// Offset (ms) such that: localWallClockAsIfUTC = actualUTC + offset.
// For Asia/Dhaka (UTC+6) this returns +6h. Used to convert a desired wall-clock
// time in a timezone into a real UTC instant.
function tzOffsetMs(date, tz) {
  const p = getZonedParts(date, tz);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
  // getZonedParts drops seconds into the minute; align to the same resolution.
  const actual = Math.floor(date.getTime() / 60000) * 60000;
  return asUTC - actual;
}

// Convert a wall-clock time (y,m,d,hh,mm) in a timezone to the matching UTC Date.
// Re-checks the offset once so a DST transition near the target still resolves.
export function zonedWallTimeToUtc(year, month, day, hour, minute, tz) {
  const wallAsUTC = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = tzOffsetMs(new Date(wallAsUTC), tz);
  let utc = wallAsUTC - offset;
  const offset2 = tzOffsetMs(new Date(utc), tz);
  if (offset2 !== offset) utc = wallAsUTC - offset2;
  return new Date(utc);
}

// "HH:MM" → minutes since midnight (or null if malformed).
function parseHM(hm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || "").trim());
  if (!m) return null;
  const h = +m[1], mm = +m[2];
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

// Normalise the days-enabled flag into a 7-element boolean array (0=Sun..6=Sat).
function normDays(days) {
  if (Array.isArray(days) && days.length === 7) return days.map(Boolean);
  return [true, true, true, true, true, true, true];
}

// Is `date` inside any allowed window for this timezone right now?
export function isWithinWindow(date, tz, windows, days) {
  const wins = Array.isArray(windows) && windows.length ? windows : [{ start: "10:00", end: "18:00" }];
  const enabled = normDays(days);
  const p = getZonedParts(date, tz);
  if (!enabled[p.weekday]) return false;
  const mins = p.hour * 60 + p.minute;
  for (const w of wins) {
    const s = parseHM(w.start), e = parseHM(w.end);
    if (s == null || e == null || e <= s) continue;
    if (mins >= s && mins < e) return true;
  }
  return false;
}

// The next instant (>= date) that falls inside an allowed window. If `date` is
// already inside a window, returns `date`. Searches up to `horizonDays` ahead;
// if nothing is found (e.g. all days disabled) returns null.
export function nextOpen(date, tz, windows, days, horizonDays = 21) {
  if (isWithinWindow(date, tz, windows, days)) return date;
  const wins = (Array.isArray(windows) && windows.length ? windows : [{ start: "10:00", end: "18:00" }])
    .map((w) => ({ s: parseHM(w.start), e: parseHM(w.end) }))
    .filter((w) => w.s != null && w.e != null && w.e > w.s)
    .sort((a, b) => a.s - b.s);
  if (!wins.length) return null;
  const enabled = normDays(days);

  for (let off = 0; off <= horizonDays; off++) {
    // The calendar date `off` days from now, as seen in the target timezone.
    const probe = getZonedParts(new Date(date.getTime() + off * 86400000), tz);
    if (!enabled[probe.weekday]) continue;
    for (const w of wins) {
      const start = zonedWallTimeToUtc(probe.year, probe.month, probe.day, Math.floor(w.s / 60), w.s % 60, tz);
      if (start.getTime() >= date.getTime()) return start;
    }
  }
  return null;
}

// ── disposition classification ──────────────────────────────────────────────
// Maps a finished call into one of our 4 user-facing outcomes. Telephony-based:
//   • declined  — the prospect actively rejected the call (busy / canceled).
//   • missed    — the call rang out / failed to connect (no-answer / failed).
//   • attended  — the prospect picked up and a real conversation happened.
//   • do-not-call — the prospect explicitly asked not to be called (no retry).
// Both `missed` and `declined` are retried; `attended` and `do-not-call` aren't.
export function deriveDisposition(call) {
  const result = call?.result || {};
  if (result.doNotCall) return "do-not-call";
  const reason = call?.endedReason || result.endedReason || "";
  if (reason === "twilio-busy" || reason === "twilio-canceled") return "declined";
  if (reason === "twilio-no-answer" || reason === "twilio-failed") return "missed";
  // The call was answered. Did the prospect genuinely speak? If so, we reached
  // them — count it as attended regardless of whether they became a lead. If the
  // line was silent / errored out, we never really reached them → missed.
  const hadConversation = typeof result.transcript === "string" && result.transcript.trim().length > 0
    && !/No genuine response from the prospect/i.test(result.summary || "");
  return hadConversation ? "attended" : "missed";
}

const RETRYABLE = new Set(["missed", "declined"]);

// ── scheduler state (injected dependencies) ─────────────────────────────────
let store = null;        // campaigns store (campaigns.js)
let placeCall = null;    // (params) => Promise<{ callId }>  (from index.js)
let timer = null;
let running = false;     // re-entrancy guard for tick()

// Resolve which timezone / windows / days apply to one attempt's number.
// Per-country overrides win by LONGEST matching calling-code prefix; otherwise
// the campaign default applies. This implements "default + per-country override".
export function resolveWindow(campaign, attempt) {
  const digits = String(attempt.phone || "").replace(/[^\d]/g, "");
  const overrides = campaign.countryOverrides || {};
  let best = null;
  for (const code of Object.keys(overrides)) {
    if (code && digits.startsWith(code) && (!best || code.length > best.length)) best = code;
  }
  if (best) {
    const o = overrides[best] || {};
    return {
      tz: o.tz || campaign.defaultTz,
      windows: (o.windows && o.windows.length) ? o.windows : campaign.defaultWindows,
      days: o.days || campaign.days,
    };
  }
  return { tz: campaign.defaultTz, windows: campaign.defaultWindows, days: campaign.days };
}

// The earliest allowed dial time for an attempt at-or-after `from`.
export function nextAllowed(campaign, attempt, from = new Date()) {
  const { tz, windows, days } = resolveWindow(campaign, attempt);
  const t = nextOpen(from, tz || "UTC", windows, days);
  return t || from;
}

// Start the background loop. tickMs defaults to 60s.
export function start({ store: s, placeCall: p, tickMs = 60000 } = {}) {
  store = s;
  placeCall = p;
  if (timer) clearInterval(timer);
  timer = setInterval(() => { tick().catch((e) => console.error("⚠ scheduler tick error:", e?.message || e)); }, tickMs);
  timer.unref?.();
  console.log(`ℹ  Bulk-calling scheduler started (tick every ${Math.round(tickMs / 1000)}s).`);
  // Kick once shortly after boot so a freshly-created campaign starts promptly.
  setTimeout(() => { tick().catch(() => {}); }, 2000).unref?.();
}

async function tick() {
  if (running || !store || !placeCall) return;
  running = true;
  try {
    const campaigns = await store.listActiveCampaigns();
    const now = new Date();
    for (const c of campaigns) {
      if (c.status !== "running") continue;
      const attempts = await store.listAttempts(c.id);
      if (!attempts.length) continue;

      // Mark a campaign complete once every number has reached a terminal state.
      const terminal = (a) => a.status === "done" || a.status === "canceled";
      if (attempts.every(terminal)) {
        await store.updateCampaign(c.id, { status: "completed" });
        continue;
      }

      const active = attempts.filter((a) => a.status === "calling").length;
      let budget = Math.max(0, (Number(c.concurrency) || 1) - active);
      if (budget <= 0) continue;

      const due = attempts
        .filter((a) => a.status === "queued")
        .filter((a) => new Date(a.nextRunAt).getTime() <= now.getTime())
        .filter((a) => {
          const { tz, windows, days } = resolveWindow(c, a);
          return isWithinWindow(now, tz || "UTC", windows, days);
        })
        .sort((x, y) => new Date(x.nextRunAt) - new Date(y.nextRunAt));

      for (const a of due) {
        if (budget <= 0) break;
        budget--;
        await dial(c, a);
      }
    }
  } finally {
    running = false;
  }
}

async function dial(campaign, attempt) {
  // Flip to "calling" FIRST so a slow placeCall can't be double-dialed by the
  // next tick (and so concurrency accounting is correct).
  await store.updateAttempt(attempt.id, { status: "calling", updatedAt: new Date().toISOString() });
  const secrets = store.getSecrets(campaign.id) || {};
  try {
    const { callId } = await placeCall({
      ...(campaign.callConfig || {}),
      ...secrets,
      clientId: attempt.clientId,
      name: attempt.name,
      contact: attempt.contact,
      phone: attempt.phone,
      industry: attempt.industry,
      campaignAttemptId: attempt.id,
    });
    await store.updateAttempt(attempt.id, { lastCallId: callId, updatedAt: new Date().toISOString() });
  } catch (err) {
    const status = err?.status;
    if (status === 500) {
      // Missing credentials / PUBLIC_URL — a config problem, not the prospect's
      // fault (e.g. after a restart that lost in-memory keys). Don't waste an
      // attempt: requeue the number and pause the campaign with a reason so the
      // user can re-supply keys and resume.
      console.warn(`[campaign ${campaign.id}] paused — ${err.message}`);
      await store.updateAttempt(attempt.id, { status: "queued", updatedAt: new Date().toISOString() });
      await store.updateCampaign(campaign.id, { status: "paused", pausedReason: err.message });
      return;
    }
    if (status === 400) {
      // Permanently unusable number (failed validation / Twilio refused it).
      // Finish it without retrying so it can't loop forever.
      console.warn(`[campaign ${campaign.id}] dropping ${attempt.phone}: ${err.message}`);
      await store.updateAttempt(attempt.id, {
        status: "done", disposition: "invalid", lastSummary: err.message, updatedAt: new Date().toISOString(),
      });
      return;
    }
    // Network / transient Twilio reachability problem — count as a missed
    // attempt so it follows the normal retry + cap rules.
    console.warn(`[campaign ${campaign.id}] could not place call to ${attempt.phone}: ${err?.message || err}`);
    await onOutcome(attempt.id, "missed", `Could not place call: ${err?.message || err}`);
  }
}

// Called by index.js's finalizeCall when a campaign-linked call settles.
export async function onCallFinalized(call) {
  if (!store || !call?.campaignAttemptId) return;
  const disp = deriveDisposition(call);
  await onOutcome(
    call.campaignAttemptId,
    disp,
    call.result?.summary || "",
    call.result?.meetingTime || "",
  );
}

// Apply an outcome to an attempt: record it, then either finish it or schedule
// the next retry (clamped into office hours), respecting the max-attempts cap.
async function onOutcome(attemptId, disposition, summary, meetingTime) {
  const a = await store.getAttempt(attemptId);
  if (!a || a.status === "done" || a.status === "canceled") return;
  const campaign = await store.getCampaign(a.campaignId);
  const tries = (Number(a.attempts) || 0) + 1;
  const maxAttempts = Number(campaign?.maxAttempts) || 3;
  const history = [...(a.history || []), { at: new Date().toISOString(), disposition, summary }];
  const patch = {
    attempts: tries,
    disposition,
    history,
    lastSummary: summary || "",
    lastMeetingTime: meetingTime || "",
    updatedAt: new Date().toISOString(),
  };

  if (RETRYABLE.has(disposition) && tries < maxAttempts) {
    const delayMin = Number(campaign?.retryDelayMinutes) || 120;
    const base = new Date(Date.now() + delayMin * 60000);
    patch.status = "queued";
    patch.nextRunAt = nextAllowed(campaign, a, base).toISOString();
  } else {
    // Attended, do-not-call, or retries exhausted → finished. The final
    // disposition (e.g. "missed" after 3 tries) is preserved for the dashboard.
    patch.status = "done";
  }
  await store.updateAttempt(attemptId, patch);
}
