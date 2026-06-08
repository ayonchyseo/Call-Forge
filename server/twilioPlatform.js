// CallForge — platform Twilio provisioning ("become the platform" model).
//
// BYOK (the original model) makes every end-user pass Twilio's own KYC/Trust
// Hub review before they can place +1 calls — a dealbreaker for a plug-and-play
// product (see error 21216: "+1 calls blocked without an approved Primary
// Customer Profile"). The fix every competitor in this space uses (Bland, Vapi,
// Retell, Synthflow, ...): YOU become the regulated telephony entity. Complete
// Trust Hub ONCE on your own "master" Twilio account, then auto-create an
// isolated **subaccount + phone number** for each approved user. Subaccounts
// can share the parent's verified Customer Profile (Twilio Console → Trust Hub
// → Customer Profiles → share with subaccounts — a one-time setup step), so +1
// calls placed from them aren't blocked by 21216 — and the end-user never sees
// Twilio, KYC, or Trust Hub at all.
//
// Turn this on by setting PLATFORM_TWILIO_SID / PLATFORM_TWILIO_TOKEN to your
// master account's primary credentials (Twilio Console → Account → API keys &
// tokens — the main Account SID/Auth Token, NOT a subaccount's). Until those
// are set, this module is inert and CallForge keeps running in pure BYOK mode —
// nothing changes for existing deployments.

const PLATFORM_TWILIO_SID = process.env.PLATFORM_TWILIO_SID || "";
const PLATFORM_TWILIO_TOKEN = process.env.PLATFORM_TWILIO_TOKEN || "";
const NUMBER_COUNTRY = (process.env.PLATFORM_NUMBER_COUNTRY || "US").toUpperCase();
const NUMBER_AREA_CODE = process.env.PLATFORM_NUMBER_AREA_CODE || "";

export const platformEnabled = Boolean(PLATFORM_TWILIO_SID && PLATFORM_TWILIO_TOKEN);

if (platformEnabled) {
  console.log(`ℹ  Platform Twilio: ON — approved users get an auto-provisioned ${NUMBER_COUNTRY} number${NUMBER_AREA_CODE ? ` (area code ${NUMBER_AREA_CODE})` : ""} and zero Twilio/KYC setup of their own.`);
} else {
  console.log("ℹ  Platform Twilio: OFF — set PLATFORM_TWILIO_SID/PLATFORM_TWILIO_TOKEN on the server to auto-provision a subaccount + number per approved user (true plug-and-play; you carry the Twilio cost). Until then, users supply their own Twilio keys in ⚙ Settings.");
}

function basicAuth(sid, token) {
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

async function twilioApi(pathAndQuery, { sid, token, method = "GET", body } = {}) {
  const r = await fetch(`https://api.twilio.com/2010-04-01/${pathAndQuery}`, {
    method,
    headers: {
      Authorization: basicAuth(sid, token),
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(data?.message || `Twilio API error ${r.status}`);
    err.status = r.status;
    err.twilioCode = data?.code;
    err.data = data;
    throw err;
  }
  return data;
}

// Step 1 — an isolated subaccount for this user. Its calls/usage/spend are
// tracked separately from the master and from every other user's (the
// foundation for per-user metering/billing), but it shares the parent's
// Trust Hub identity — that's what unlocks +1 calling without per-user KYC.
async function createSubaccount(friendlyName) {
  return twilioApi("Accounts.json", {
    sid: PLATFORM_TWILIO_SID,
    token: PLATFORM_TWILIO_TOKEN,
    method: "POST",
    body: new URLSearchParams({ FriendlyName: friendlyName.slice(0, 64) }),
  });
}

// Best-effort cleanup for a subaccount that ended up numberless, so it doesn't
// just sit there. Failure here must never mask the original provisioning error.
async function suspendSubaccount(subSid) {
  try {
    await twilioApi(`Accounts/${subSid}.json`, {
      sid: PLATFORM_TWILIO_SID,
      token: PLATFORM_TWILIO_TOKEN,
      method: "POST",
      body: new URLSearchParams({ Status: "suspended" }),
    });
  } catch { /* best effort — original error is what matters */ }
}

// Step 2 — buy a local voice number and land it directly in the subaccount
// (search + purchase authenticated AS the subaccount, so Twilio assigns and
// bills it there, never on the master).
async function buyNumberFor(subSid, subToken) {
  const q = new URLSearchParams({ VoiceEnabled: "true", SmsEnabled: "false" });
  if (NUMBER_AREA_CODE) q.set("AreaCode", NUMBER_AREA_CODE);

  const found = await twilioApi(`Accounts/${subSid}/AvailablePhoneNumbers/${NUMBER_COUNTRY}/Local.json?${q}`, { sid: subSid, token: subToken });
  const candidate = found?.available_phone_numbers?.[0]?.phone_number;
  if (!candidate) {
    throw new Error(`No ${NUMBER_COUNTRY} numbers available${NUMBER_AREA_CODE ? ` for area code ${NUMBER_AREA_CODE}` : ""} right now — set PLATFORM_NUMBER_AREA_CODE to a different one (or remove it) and retry.`);
  }

  const bought = await twilioApi(`Accounts/${subSid}/IncomingPhoneNumbers.json`, {
    sid: subSid,
    token: subToken,
    method: "POST",
    body: new URLSearchParams({ PhoneNumber: candidate }),
  });
  return bought.phone_number;
}

// Orchestrates subaccount + number creation for a newly-approved user. Throws
// on failure — the caller persists status/error (see auth.js `provisionNow`).
// If the number purchase fails after the subaccount was created, the orphaned
// subaccount is suspended so it doesn't sit there "active" with no purpose.
export async function provisionUser(user) {
  if (!platformEnabled) throw new Error("Platform Twilio isn't configured on this server (PLATFORM_TWILIO_SID/PLATFORM_TWILIO_TOKEN missing).");

  const sub = await createSubaccount(`CallForge — ${user.email}`);
  try {
    const phoneNumber = await buyNumberFor(sub.sid, sub.auth_token);
    return { subaccountSid: sub.sid, subaccountToken: sub.auth_token, phoneNumber };
  } catch (err) {
    await suspendSubaccount(sub.sid);
    throw err;
  }
}
