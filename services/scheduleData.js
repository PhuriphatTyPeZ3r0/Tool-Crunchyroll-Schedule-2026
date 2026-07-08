/**
 * scheduleData — fetches the anime airing schedule from AniList's public GraphQL
 * API (https://graphql.anilist.co). No auth, no Cloudflare, no tokens.
 *
 * Why AniList instead of Crunchyroll's own API: Crunchyroll sits behind Cloudflare
 * bot management that enforces TLS/JA3 fingerprints — plain HTTP can't reach it.
 * AniList exposes the same per-episode airing times (airingAt) plus streaming links
 * (including Crunchyroll), which is exactly what a season calendar needs.
 *
 * Normalized output (consumed by calendarGenerator):
 *   { id, seriesTitle, episodeNumber, availableDate: Date, url, isDub }
 *
 * Note: AniList tracks the original (sub/simulcast) broadcast time. Dedicated DUB
 * release dates are not available here, so the calendar is sub/simulcast only.
 */

const ANILIST_URL = "https://graphql.anilist.co";

// Season window (Summer 2026). Overridable via env.
const SEASON_START = new Date(process.env.SEASON_START || "2026-06-28T00:00:00Z");
const SEASON_END = new Date(process.env.SEASON_END || "2026-09-30T23:59:59Z");
// Keep only shows streaming on Crunchyroll (true) or every airing anime (false).
const CR_ONLY = (process.env.CR_ONLY ?? "true") !== "false";

const QUERY = `
query ($start: Int, $end: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
      episode
      airingAt
      media {
        id
        title { romaji english native }
        siteUrl
        format
        externalLinks { site url }
      }
    }
  }
}`;

async function queryPage(page, startSec, endSec) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { start: startSec, end: endSec, page } }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`AniList ${res.status}: ${text.slice(0, 200)}`);
  const json = JSON.parse(text);
  if (json.errors) throw new Error(`AniList errors: ${JSON.stringify(json.errors).slice(0, 200)}`);
  return json.data.Page;
}

function crunchyrollLink(media) {
  const link = media.externalLinks?.find((l) => l.site === "Crunchyroll");
  return link?.url || null;
}

function normalize(sched) {
  const media = sched.media;
  if (!media) return null;
  const crUrl = crunchyrollLink(media);
  if (CR_ONLY && !crUrl) return null; // not on Crunchyroll

  const title = media.title.english || media.title.romaji || media.title.native || "Unknown";
  return {
    id: `${media.id}-${sched.episode}`,
    seriesTitle: title,
    episodeNumber: sched.episode,
    availableDate: new Date(sched.airingAt * 1000),
    url: crUrl || media.siteUrl,
    isDub: false,
  };
}

/** Fetch + normalize the season schedule, sorted by air date ascending. */
export async function fetchSchedule() {
  const startSec = Math.floor(SEASON_START.getTime() / 1000);
  const endSec = Math.floor(SEASON_END.getTime() / 1000);

  const events = [];
  for (let page = 1; page <= 20; page++) {
    const { pageInfo, airingSchedules } = await queryPage(page, startSec, endSec);
    for (const s of airingSchedules) {
      const ev = normalize(s);
      if (ev) events.push(ev);
    }
    if (!pageInfo.hasNextPage) break;
  }

  return events.sort((a, b) => a.availableDate - b.availableDate);
}
