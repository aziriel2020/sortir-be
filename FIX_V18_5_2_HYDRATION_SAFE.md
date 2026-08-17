# SORTIR.BE V18.5.2 — Hydration-safe live-only fix

Fixes the production white screen introduced in V18.5.

## Production errors addressed
- React minified error #418: restored the known-good V18.4.2 SSR/client bundle pair.
- `M is not defined`: removed the broken LIVEONLY185 bundle and restored the original accent/helper definitions.
- `Invalid time value`: live events are filtered for valid `start` dates before transformation; accepted `/api/live` payloads always have a valid `generatedAt`.

## Live-only behavior
- No physical `events-snapshot.json`.
- No physical `collector-status.json`.
- No `/events-snapshot.json` request.
- The legacy compiled hydration seed is retained internally only because the recovered Vinext build requires an identical SSR/client tree to hydrate safely. It is covered by a CSS gate and is never merged into live API results or exposed as a runtime fallback.
- The page becomes visible only after a valid `/api/live` response has committed to React.
- If the initial live scan fails, stale SSR remains hidden and the gate reports the failure.
- Refresh failures cannot replace the currently displayed live data with fallback data.
