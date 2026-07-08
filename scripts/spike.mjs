/**
 * SPIKE — throwaway probe to verify assumptions against the LIVE Crunchyroll API
 * before we build the real project.
 *
 * Run:  node --env-file=.env scripts/spike.mjs
 * (optional) probe a real calendar URL you grabbed from DevTools:
 *           CALENDAR_URL="https://..." node --env-file=.env scripts/spike.mjs
 *
 * Goals:
 *   1. Prove the refresh_token grant works and returns a usable access_token.
 *   2. Dump the shape of the `browse?sort_by=newly_added` endpoint to settle the
 *      argument: is it SERIES-level (no per-episode air dates) or EPISODE-level?
 *   3. If you paste a real simulcast-calendar URL, dump its shape too.
 */

const AUTH_URL = "https://www.crunchyroll.com/auth/v1/token";
const BASE = "https://www.crunchyroll.com";
// Look like a real browser — Crunchyroll sits behind Cloudflare bot management.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const { BASIC_AUTH_TOKEN, REFRESH_TOKEN, LOCALE = "th-TH", PREFERRED_AUDIO_LANGUAGE = "th-TH" } = process.env;

function must(name, val) {
  if (!val) { console.error(`Missing env: ${name}. Did you run with --env-file=.env ?`); process.exit(1); }
  return val;
}

/** Print a shallow map of an object's keys and the type/sample of each value. */
function describe(obj, label) {
  console.log(`\n===== ${label} =====`);
  if (obj === null || typeof obj !== "object") { console.log(typeof obj, JSON.stringify(obj)?.slice(0, 200)); return; }
  for (const [k, v] of Object.entries(obj)) {
    let desc;
    if (Array.isArray(v)) desc = `Array(${v.length})`;
    else if (v && typeof v === "object") desc = `Object {${Object.keys(v).slice(0, 8).join(", ")}}`;
    else desc = `${typeof v}: ${JSON.stringify(v)?.slice(0, 80)}`;
    console.log(`  ${k.padEnd(28)} ${desc}`);
  }
}

async function getAccessToken() {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${must("BASIC_AUTH_TOKEN", BASIC_AUTH_TOKEN)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: must("REFRESH_TOKEN", REFRESH_TOKEN) }),
  });
  const text = await res.text();
  if (!res.ok) { console.error(`AUTH FAILED ${res.status}:`, text.slice(0, 400)); process.exit(1); }
  const json = JSON.parse(text);
  console.log("AUTH OK.");
  console.log("  refresh_token returned:", json.refresh_token);
  console.log("  ROTATION CHECK:", json.refresh_token === REFRESH_TOKEN
    ? "SAME as input  → token is STABLE, .env storage is enough."
    : "DIFFERENT      → token ROTATES, we need a persistent store!");
  console.log("  expires_in:", json.expires_in, "| account_id:", json.account_id);
  return json.access_token;
}

async function probe(url, token, label) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "User-Agent": UA } });
  const text = await res.text();
  console.log(`\n### ${label}\n### ${url}\n### HTTP ${res.status}`);
  if (!res.ok) { console.log("  body:", text.slice(0, 400)); return; }
  let json; try { json = JSON.parse(text); } catch { console.log("  (non-JSON response, first 300 chars)\n", text.slice(0, 300)); return; }
  describe(json, "top level");
  const items = json.data || json.items || (Array.isArray(json) ? json : null);
  if (Array.isArray(items) && items.length) {
    console.log(`\n  total items: ${items.length}`);
    describe(items[0], "items[0]  <-- is this a SERIES or an EPISODE?");
    // The decisive fields for building a per-episode schedule:
    const it = items[0];
    console.log("\n  DECISIVE FIELDS on items[0]:");
    for (const f of ["type", "premium_available_date", "sequence_number", "episode_number", "series_title", "title", "id"]) {
      console.log(`    ${f.padEnd(24)} ${JSON.stringify(it?.[f]) ?? "—"}`);
    }
  }
}

const token = await getAccessToken();

// 2. The endpoint proposed in the plan — let's see what it actually returns.
await probe(
  `${BASE}/content/v2/discover/browse?locale=${LOCALE}&preferred_audio_language=${PREFERRED_AUDIO_LANGUAGE}&sort_by=newly_added&n=5`,
  token, "PLAN'S ENDPOINT: discover/browse?sort_by=newly_added",
);

// 3. If you grabbed the real calendar request URL from DevTools, probe it too.
if (process.env.CALENDAR_URL) {
  await probe(process.env.CALENDAR_URL, token, "YOUR REAL CALENDAR URL");
} else {
  console.log("\n(No CALENDAR_URL provided — skip. Grab the real simulcast-calendar request from DevTools and re-run with it.)");
}
