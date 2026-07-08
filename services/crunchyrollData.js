/**
 * crunchyrollData — fetches the release schedule and normalizes it into a flat
 * array of calendar-ready events.
 *
 * ⚠️ ENDPOINT ASSUMPTION (must be verified with `npm run spike`):
 *   We hit `discover/browse?sort_by=newly_added`. Its items are expected to be
 *   EPISODE panels carrying `episode_metadata` (series_title, episode_number,
 *   premium_available_date, audio_locale). If the live shape differs, this is the
 *   ONE function to adjust — everything downstream consumes the normalized shape:
 *
 *     { id, seriesTitle, episodeNumber, availableDate: Date, url, isDub }
 *
 *   NOTE: `newly_added` returns RECENTLY RELEASED episodes (good for the part of the
 *   season that has already aired). Truly-upcoming episodes require Crunchyroll's
 *   weekly simulcast-calendar endpoint, which we could not confirm during grilling.
 *   Grab its real URL from DevTools and swap `SCHEDULE_URL` + the mapping below.
 */

import { getAccessToken } from "./crunchyrollAuth.js";

const BASE = "https://www.crunchyroll.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const LOCALE = process.env.LOCALE || "th-TH";
const AUDIO = process.env.PREFERRED_AUDIO_LANGUAGE || "th-TH";

// Season window (Summer 2026). Overridable via env. Events outside this range
// are dropped so the calendar shows exactly one season.
const SEASON_START = new Date(process.env.SEASON_START || "2026-06-28T00:00:00Z");
const SEASON_END = new Date(process.env.SEASON_END || "2026-09-30T23:59:59Z");

const PAGE_SIZE = 100; // Crunchyroll caps n at ~100
const MAX_PAGES = 4; // safety cap on pagination

function scheduleUrl(start) {
  const p = new URLSearchParams({
    locale: LOCALE,
    preferred_audio_language: AUDIO,
    sort_by: "newly_added",
    n: String(PAGE_SIZE),
    start: String(start),
  });
  return `${BASE}/content/v2/discover/browse?${p.toString()}`;
}

async function fetchPage(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": UA },
  });
  const text = await res.text();
  if (text.includes("Just a moment")) throw new Error("Blocked by Cloudflare (data request).");
  if (!res.ok) throw new Error(`Data fetch failed ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

/**
 * Turn one raw browse item into our normalized event, or null if it isn't an
 * episode we can place on a calendar. Defensive: tolerates missing fields.
 */
function normalize(item) {
  const meta = item.episode_metadata || item.panel?.episode_metadata || null;
  // Only episodes have an air date + episode number.
  if (!meta && item.type !== "episode") return null;

  const m = meta || {};
  const availableRaw = m.premium_available_date || m.available_date || item.premium_available_date;
  if (!availableRaw) return null;
  const availableDate = new Date(availableRaw);
  if (Number.isNaN(availableDate.getTime())) return null;

  const seriesTitle = m.series_title || item.title || "Unknown Series";
  const episodeNumber = m.episode_number ?? m.sequence_number ?? null;
  const audioLocale = m.audio_locale || "";
  const isDub = audioLocale !== "" && audioLocale !== "ja-JP";
  const id = item.id || item.panel?.id;
  if (!id) return null;

  return {
    id,
    seriesTitle,
    episodeNumber,
    availableDate,
    url: `${BASE}/watch/${id}`,
    isDub,
  };
}

/**
 * Fetch and normalize the season schedule.
 * Returns a de-duplicated array of events within the season window,
 * sorted by air date ascending.
 */
export async function fetchSchedule() {
  const token = await getAccessToken();

  const seen = new Map();
  for (let page = 0; page < MAX_PAGES; page++) {
    const json = await fetchPage(scheduleUrl(page * PAGE_SIZE), token);
    const items = json.data || json.items || [];
    if (!items.length) break;

    for (const raw of items) {
      const ev = normalize(raw);
      if (!ev) continue;
      // Keep only this season.
      if (ev.availableDate < SEASON_START || ev.availableDate > SEASON_END) continue;
      // De-dupe by episode id (+ dub flag so sub/dub of same ep can coexist).
      seen.set(`${ev.id}:${ev.isDub}`, ev);
    }
  }

  return [...seen.values()].sort((a, b) => a.availableDate - b.availableDate);
}
