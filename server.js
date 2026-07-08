/**
 * Crunchyroll (Summer 2026) anime schedule -> iCalendar (.ics) API
 *
 * Data comes from AniList's public GraphQL API (no auth / no Cloudflare), filtered
 * to shows streaming on Crunchyroll. See services/scheduleData.js.
 *
 * Routes:
 *   GET /api/health                   -> { status: "ok" }
 *   GET /api/calendar/crunchyroll.ics -> cached .ics feed (text/calendar)
 *   GET /probe                        -> diagnostic: rebuild feed, report event count
 */
import express from "express";
import { getCalendarIcs } from "./services/calendarGenerator.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/calendar/crunchyroll.ics", async (_req, res) => {
  try {
    const ics = await getCalendarIcs();
    res.set({
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="crunchyroll.ics"',
      "Cache-Control": "public, max-age=3600",
    });
    res.send(ics);
  } catch (err) {
    console.error("[server] calendar unavailable:", err.message);
    res.status(503).send("Calendar temporarily unavailable. Try again shortly.");
  }
});

// Diagnostic: rebuild the feed and report how many events it contains.
app.get("/probe", async (_req, res) => {
  try {
    const ics = await getCalendarIcs();
    const events = (ics.match(/BEGIN:VEVENT/g) || []).length;
    res.json({ ok: true, events, bytes: ics.length });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`crunchyroll-schedule listening on :${PORT}`);
  console.log(`  feed:   http://localhost:${PORT}/api/calendar/crunchyroll.ics`);
  // Warm the cache on boot so the first subscriber gets an instant response.
  getCalendarIcs()
    .then((ics) => console.log(`[boot] cache warmed: ${(ics.match(/BEGIN:VEVENT/g) || []).length} events`))
    .catch((e) => console.warn("[boot] initial fetch failed:", e.message));
});
