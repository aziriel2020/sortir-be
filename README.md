# SORTIR.BE — GitHub → Vercel

This repository is ready to import directly into Vercel.

## GitHub upload

1. Create a new empty GitHub repository.
2. Choose **Add file → Upload files**.
3. Drag the CONTENTS of this folder into GitHub.
4. Commit directly to `main`.

## Vercel

1. Open Vercel.
2. Click **Add New → Project** / **New Project**.
3. Select this GitHub repository and click **Import**.
4. Keep the repository root as the Root Directory.
5. Vercel reads `vercel.json` automatically.
6. Click **Deploy**.

No environment variables are required for this recovered snapshot version.

## Deployment architecture

- `public/` — static SORTIR.BE frontend + 2,839-event snapshot
- `api/event-photos.js` — Vercel Function
- `api/picture.js` — Vercel Function
- `/api/live` → rewritten to `/events-snapshot.json`
- `/api/events` → rewritten to `/events-snapshot.json`
- `scripts/build-vercel.mjs` — creates the static `dist/` deployment output

## Note

This version deploys the recovered current event snapshot.
The automatic live event collector can be reintroduced separately afterward.
