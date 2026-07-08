/**
 * calendarGenerator — turns normalized events into an .ics string, with a
 * soft-TTL cache that serves the last good copy when Crunchyroll fails.
 *
 * Decisions (from grilling):
 *  - Times are emitted in UTC (startInputType: 'utc'); calendar apps localize.
 *  - Stable UID per episode so refreshes UPDATE events instead of duplicating.
 *  - Soft TTL: past the TTL we try to refresh, but on failure we keep serving the
 *    stale copy. We only ever error if we have NOTHING cached yet.
 */

import { createEvents } from "ics";
import { fetchSchedule } from "./crunchyrollData.js";

const TTL_MS = Number(process.env.CACHE_TTL_MS || 60 * 60 * 1000); // 1 hour
const DURATION_MIN = 24;
const CAL_NAME = "Crunchyroll — Summer 2026";

const cache = { ics: null, builtAt: 0 };
let inFlight = null;

function toUtcArray(date) {
  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
  ];
}

function eventTitle(ev) {
  const ep = ev.episodeNumber != null ? ` - EP${ev.episodeNumber}` : "";
  const dub = ev.isDub ? " [DUB]" : "";
  return `${ev.seriesTitle}${ep}${dub}`;
}

function buildIcs(events) {
  const icsEvents = events.map((ev) => ({
    uid: `${ev.id}${ev.isDub ? "-dub" : ""}@crunchyroll-schedule`,
    title: eventTitle(ev),
    start: toUtcArray(ev.availableDate),
    startInputType: "utc",
    duration: { minutes: DURATION_MIN },
    url: ev.url,
    productId: "crunchyroll-schedule",
  }));

  const { error, value } = createEvents(icsEvents);
  if (error) throw error;

  // Inject calendar-level name/description (the `ics` package omits these).
  return value.replace(
    "VERSION:2.0",
    `VERSION:2.0\r\nX-WR-CALNAME:${CAL_NAME}\r\nX-WR-CALDESC:Crunchyroll simulcast release schedule`,
  );
}

/**
 * Return the .ics string. Refreshes if stale; on refresh failure, serves the
 * last good copy. Throws only if nothing has ever been cached.
 */
export async function getCalendarIcs() {
  const fresh = cache.ics && Date.now() - cache.builtAt < TTL_MS;
  if (fresh) return cache.ics;

  if (!inFlight) {
    inFlight = (async () => {
      const events = await fetchSchedule();
      const ics = buildIcs(events);
      cache.ics = ics;
      cache.builtAt = Date.now();
      console.log(`[calendar] rebuilt: ${events.length} events`);
      return ics;
    })().finally(() => {
      inFlight = null;
    });
  }

  try {
    return await inFlight;
  } catch (err) {
    if (cache.ics) {
      console.warn(`[calendar] refresh failed, serving stale copy: ${err.message}`);
      return cache.ics;
    }
    throw err; // cold cache — nothing to serve
  }
}
