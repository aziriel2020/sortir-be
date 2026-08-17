# SORTIR.BE V18.5 — LIVE ONLY

- No events-snapshot.json.
- No collector-status snapshot.
- No GitHub snapshot persistence workflow.
- No seeded events in the React initial state.
- No static fallback in /api/live.
- No recovered event-image map. Images are discovered from each live event source.
- First paint hides stale SSR event content until /api/live succeeds.
- If live collection fails, the UI shows an explicit error and zero cached events.
- Manual Refresh performs another live scan; it never loads old data.
