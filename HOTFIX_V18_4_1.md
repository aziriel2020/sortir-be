# V18.4.1 — Vercel schema hotfix

- Fixed `functions.*.includeFiles`: Vercel requires a single glob string, not an array.
- `api/live.js` and `api/events.js` now use `includeFiles: "**/*"` so collector/config/snapshot files are guaranteed to be bundled.
- Removed unnecessary `includeFiles` from `api/health.js`.
- Explicitly enabled `fluid: true` so `maxDuration: 300` matches current Vercel Fluid Compute behavior.
- No UI/map/dock/collector logic removed.
