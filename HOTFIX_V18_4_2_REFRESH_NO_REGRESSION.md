# V18.4.2 — Refresh no-regression hotfix

- Prevents `/events-snapshot.json` from overwriting a newer live state during Refresh.
- Prevents an older `/api/live` response from overwriting newer client data.
- Failed refresh keeps last known-good live data visible.
- Live scan acceptance now requires at least 60% of historical productive-source coverage when that baseline exists.
