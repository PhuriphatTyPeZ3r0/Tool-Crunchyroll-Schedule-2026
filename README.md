# Crunchyroll Schedule → iCalendar (.ics)

Serves the **Summer 2026** anime airing schedule (shows streaming on Crunchyroll)
as an `.ics` feed you can subscribe to in Google/Apple Calendar.

## Data source: AniList (not Crunchyroll's own API)

Crunchyroll's internal API sits behind Cloudflare bot management that enforces
TLS/JA3 fingerprints — plain HTTP clients are blocked no matter the IP or cookies
(verified: even a full browser-cookie replay from a residential IP gets a `403
Just a moment…`). So the schedule comes from **AniList's public GraphQL API**
(`https://graphql.anilist.co`): no auth, no Cloudflare, no tokens. We keep only
airings whose series has a Crunchyroll streaming link, and link events to CR.

> Note: AniList tracks the original (sub/simulcast) broadcast time. Separate DUB
> release dates aren't available, so the feed is sub/simulcast only.

## Run locally

```bash
npm install
npm start          # serves on :3000
npm run spike      # print the fetched schedule summary
```

Open `http://localhost:3000/api/calendar/crunchyroll.ics`.

## Config (`.env`, all optional)

| var | default | meaning |
|-----|---------|---------|
| `SEASON_START` / `SEASON_END` | Summer 2026 | ISO date window (UTC) |
| `CR_ONLY` | `true` | `true` = Crunchyroll shows only; `false` = all airing anime |
| `CACHE_TTL_MS` | `3600000` | how long a built feed is served before refresh |
| `PORT` | `3000` | Render sets this automatically |

No secrets required — nothing sensitive to commit.

## Routes

- `GET /api/health` → `{ "status": "ok" }`
- `GET /api/calendar/crunchyroll.ics` → the cached feed (`text/calendar`)
- `GET /probe` → `{ ok, events, bytes }` diagnostic

## Deploy to Render (free tier)

AniList is reachable from datacenter IPs, so Render works fine.

1. New → Web Service → connect this repo. Build `npm install`, start `npm start`.
2. No env vars are required (defaults = Summer 2026, Crunchyroll-only).
3. To keep the free instance from sleeping (so the in-memory cache stays warm and
   the first calendar fetch is instant), point a free uptime pinger
   (cron-job.org / UptimeRobot) at `/api/health` every ~10 min.
4. Subscribe in Google Calendar → **Other calendars → From URL** →
   `https://<your-app>.onrender.com/api/calendar/crunchyroll.ics`

## Architecture

`server.js` → `calendarGenerator` (soft-TTL cache + serve-stale-on-error, stable
per-episode UIDs, UTC times) → `scheduleData` (AniList GraphQL fetch + Crunchyroll
filter + season window).
