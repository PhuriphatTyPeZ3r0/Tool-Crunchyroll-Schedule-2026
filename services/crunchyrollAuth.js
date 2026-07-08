/**
 * crunchyrollAuth — obtains and caches a Crunchyroll access_token.
 *
 * Design decisions (from the grilling session):
 *  - Uses the `refresh_token` grant (anonymous/client_id was confirmed NOT to work).
 *  - Token lives ~300s. We cache it in memory and only refresh when it's about to
 *    expire, so a burst of requests reuses one token.
 *  - Rotation guard: if Crunchyroll ever returns a NEW refresh_token, we keep using
 *    the new one in memory. (The spike suggested the token is stable, so we do NOT
 *    wire up an external store — but we won't silently break if that changes while
 *    the process stays alive.)
 *
 * Env: BASIC_AUTH_TOKEN, REFRESH_TOKEN
 */

const AUTH_URL = "https://www.crunchyroll.com/auth/v1/token";
// Crunchyroll sits behind Cloudflare; look like a real browser.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Refresh this many ms BEFORE the real expiry, to avoid using a token mid-flight.
const EXPIRY_SKEW_MS = 30_000;

const state = {
  accessToken: null,
  expiresAt: 0, // epoch ms
  refreshToken: process.env.REFRESH_TOKEN || null,
};

let inFlight = null; // de-dupe concurrent refreshes

function assertEnv() {
  if (!process.env.BASIC_AUTH_TOKEN) throw new Error("Missing env BASIC_AUTH_TOKEN");
  if (!state.refreshToken) throw new Error("Missing env REFRESH_TOKEN");
}

async function requestToken() {
  assertEnv();
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${process.env.BASIC_AUTH_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: state.refreshToken,
    }),
  });

  const text = await res.text();
  if (text.includes("Just a moment") || text.includes("challenge-platform")) {
    throw new Error("Blocked by Cloudflare — this host's IP is being challenged. Run from a residential IP.");
  }
  if (!res.ok) {
    throw new Error(`Auth failed ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = JSON.parse(text);
  state.accessToken = json.access_token;
  state.expiresAt = Date.now() + json.expires_in * 1000;

  // Rotation guard.
  if (json.refresh_token && json.refresh_token !== state.refreshToken) {
    console.warn("[auth] refresh_token ROTATED — updating in-memory copy. Consider persisting it.");
    state.refreshToken = json.refresh_token;
  }
  return state.accessToken;
}

/** Return a valid access token, refreshing only when needed. */
export async function getAccessToken() {
  if (state.accessToken && Date.now() < state.expiresAt - EXPIRY_SKEW_MS) {
    return state.accessToken;
  }
  if (!inFlight) {
    inFlight = requestToken().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
