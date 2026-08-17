# SORTIR.BE V18.4 — REAL LIVE RUNTIME FIX

This release fixes the live-source regression introduced during the Vercel migration.

## Fixed

- `/api/live` no longer rewrites stale historic source stats to `0/100`.
- Stale state is carried by `stats.fresh=false`; productive/successful source counts remain truthful.
- The React bundle now requires `stats.fresh !== false` before displaying LIVE.
- `Refresh now` now forces one real server-side scan of the 100 direct radars.
- A stale 15-minute window also triggers a real server-side scan automatically.
- Manual refresh is one-shot; the browser does not force a full scan forever after one click.
- Automatic live responses are CDN-shareable for the current window; manual refresh is no-store.
- Vercel live function includes collector code/config and can run up to 300 seconds.
- GitHub Action collector now fails explicitly when a scan is not accepted instead of silently validating the old snapshot.
- Source catalogue regeneration was removed from every workflow run so the recovered source configuration is stable.
- Failed scans preserve the last-good generatedAt and source statistics.
- Collector diagnostics are uploaded as a GitHub Actions artifact.

## Regression tests

- Live runtime accepted scan: PASS
- Failed scan preserves historical source stats: PASS
- `/api/live` manual refresh E2E: PASS
- Passive stale API returns 95/100 rather than 0/100: PASS
- Responsive render QA: 104/104 PASS
- Map/dock/drawer QA: 14/14 PASS
- Mobile filter scroll regression: PASS
