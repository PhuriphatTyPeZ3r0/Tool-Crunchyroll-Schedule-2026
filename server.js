/**
 * Crunchyroll -> iCalendar (.ics) API
 *
 * Routes:
 *   GET /api/health                  -> { status: "ok" }
 *   GET /api/calendar/crunchyroll.ics -> the cached .ics feed (text/calendar)
 *   GET /probe                       -> diagnostic: can THIS host reach Crunchyroll?
 *
 * Runs on a residential IP (home machine) exposed via Cloudflare Tunnel, because
 * Crunchyroll's Cloudflare blocks datacenter IPs (confirmed against Render).
 */
import express from "express";
import { getCalendarIcs } from "./services/calendarGenerator.js";
import { getAccessToken } from "./services/crunchyrollAuth.js";

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
    // Only reached on a cold cache with a failing upstream.
    console.error("[server] calendar unavailable:", err.message);
    res.status(503).send("Calendar temporarily unavailable. Try again shortly.");
  }
});

// Diagnostic: quick check that this host can authenticate against Crunchyroll.
app.get("/probe", async (_req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ ok: true, tokenPreview: `${token.slice(0, 12)}...` });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`crunchyroll-schedule listening on :${PORT}`);
  console.log(`  feed:   http://localhost:${PORT}/api/calendar/crunchyroll.ics`);
  console.log(`  health: http://localhost:${PORT}/api/health`);
  // Warm the cache on boot so the first subscriber gets an instant response.
  getCalendarIcs().catch((e) => console.warn("[boot] initial fetch failed:", e.message));
});
