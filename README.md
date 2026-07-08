# Crunchyroll → iCalendar (.ics) API

Serves Crunchyroll's simulcast release schedule as an `.ics` feed you can subscribe
to in Google/Apple Calendar.

## ⚠️ Must run on a residential IP

Crunchyroll is behind Cloudflare bot management, which **blocks datacenter IPs**
(confirmed: Render returns a `403 Just a moment…` challenge). Run this on a home
machine / mini-PC / Raspberry Pi and expose it with a **Cloudflare Tunnel**.
Cloud hosts (Render/Railway/Fly/AWS/…) will be blocked.

## Setup

```bash
npm install
cp .env.example .env   # then fill in REFRESH_TOKEN (see below)
npm start
```

`.env`:

| var | what |
|-----|------|
| `BASIC_AUTH_TOKEN` | public web-client credentials (base64). Already filled in `.env.example`. |
| `REFRESH_TOKEN` | **your account's** refresh token — from DevTools → `POST auth/v1/token` response. |
| `SEASON_START` / `SEASON_END` | ISO dates bounding the season (default: Summer 2026). |
| `CACHE_TTL_MS` | how long a built feed is served before refresh (default 1h). |

## Routes

- `GET /api/health` → `{ "status": "ok" }`
- `GET /api/calendar/crunchyroll.ics` → the cached feed (`text/calendar`)
- `GET /probe` → diagnostic: can this host authenticate against Crunchyroll?

## Verify it works (do this first, on the home machine)

```bash
npm run spike
```

Tells you: (1) does auth succeed from your IP, (2) does the `refresh_token` rotate,
(3) is the `browse` endpoint **series-** or **episode-**shaped.

> **Known open risk:** `discover/browse?sort_by=newly_added` returns *recently
> released* episodes, not *upcoming* ones. If the feed is missing future episodes,
> swap `SCHEDULE_URL` + the mapping in `services/crunchyrollData.js` for the real
> weekly simulcast-calendar endpoint (grab its URL from DevTools). That file is the
> only place that needs to change.

## Expose with Cloudflare Tunnel (stable URL)

Use a **named** tunnel (not a `trycloudflare.com` quick tunnel — those URLs change
on restart and break the subscription). Requires a domain on a free Cloudflare
account:

```bash
cloudflared tunnel login
cloudflared tunnel create cr-schedule
cloudflared tunnel route dns cr-schedule cr.yourdomain.com
cloudflared tunnel run --url http://localhost:3000 cr-schedule
```

Then in Google Calendar → **Other calendars → From URL** →
`https://cr.yourdomain.com/api/calendar/crunchyroll.ics`

## Architecture

`server.js` → `calendarGenerator` (soft-TTL cache + serve-stale-on-error) →
`crunchyrollData` (fetch + normalize + season filter) → `crunchyrollAuth`
(refresh-token grant, in-memory token cache).
