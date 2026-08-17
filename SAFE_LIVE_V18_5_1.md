# V18.5.1 Safe Live

- Restores the known-good V18.4.2 compiled frontend to preserve Vinext/React hydration.
- Does not call /events-snapshot.json.
- Does not merge the compiled hydration seed into live API results.
- Physical snapshot/status JSON files are absent.
- A hydration-safe CSS gate hides the SSR seed until /api/live has committed to React.
- If live API fails, stale SSR remains hidden and an error message is shown.
