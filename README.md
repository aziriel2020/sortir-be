# SORTIR.BE — V18.5 LIVE ONLY

This repository is **live-only**. There is no static event dataset and no fallback event cache.

## Runtime

- `/api/live` scans the configured direct public radars.
- A successful response is cached by Vercel for the current ~15-minute window.
- `Refresh now` forces a new server scan with `refresh=1`.
- If live collection fails, the API returns an error and the UI shows no old events.
- Event photos are discovered from each live source page at runtime.

## Explicitly removed

- persisted event JSON fallback
- persisted collector-status data
- recovered event-image lookup table
- static seeded event arrays
- GitHub workflow that committed event data
- frontend fallback fetch

## Vercel

Import the repository in Vercel and deploy. No static event data is required.

The source catalogue is `config/sources.generated.json`.
