# SORTIR.BE V18.3.1 — Emergency freeze hotfix

## Root cause

V18.3 added `sortir-live-freshness-v18_3.js`. Its `MutationObserver` watched DOM changes while `apply()` modified the same watched DOM on every callback. That could create an endless mutation cycle, consume the browser main thread and make the site appear blocked/frozen.

## Fix

- Removed the freshness overlay script from `public/index.html`.
- Replaced the old asset with an inert compatibility shim so stale browser HTML cannot restart the loop.
- Kept the V18.2 map, mobile dock/drawer fixes and the V18.3 collector.
- Fresh/stale truth continues to come from `/api/live` and the existing React fallback/live state.

## Deployment

Replace the repo contents with this version and commit to `main`. Vercel will redeploy.
