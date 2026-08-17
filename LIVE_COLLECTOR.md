# SORTIR.BE V18.3 — FULL LIVE COLLECTOR

## Architecture

- Vercel serves the web app and `/api/live`.
- GitHub Actions runs the public collector every 15 minutes.
- The recovered production frontend bundle is the source of truth for the source catalogue.
- `tools/extract-source-config.mjs` recovers **623 registered sources**:
  - 100 direct automatic radars
  - 478 public/reference sources
  - 45 protected sources
- The fast collector scans the 100 direct radars every 15 minutes.
- A deep public scan runs every 2 hours and merges discoveries with the current snapshot.
- Data is written to `public/events-snapshot.json` and committed to `main`.
- Vercel's Git integration deploys commits on the production branch.

## No fake live status

`generatedAt` only advances when a scan is accepted (at least 8 newly parsed events across at least 4 productive sources).
A failed collector attempt records `collectorAttemptedAt` but keeps the previous `generatedAt`.
`/api/live` marks data older than 45 minutes as stale, and the frontend cannot display the LIVE state in that case.

## First launch after uploading the repo

1. Open the repository on GitHub.
2. Open **Actions**.
3. Select **SORTIR.BE Live Collector**.
4. Choose **Run workflow** → `fast`.
5. Watch the run. It will update `public/events-snapshot.json` and commit the data automatically.
6. Vercel will deploy the new commit from `main` through the normal Git integration.

After that the schedule takes over automatically.

## Public vs protected sources

The public/direct collector does not need login credentials.
Protected sources are never bypassed.
Optional authorized integrations are supported through GitHub repository secrets when available:

- `BRUSSELS_AGENDA_TOKEN`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_IDS`

The site remains functional without these protected-source secrets.

## Useful commands

```bash
npm run sources:recover
npm run collect
npm run collect:deep
npm run collect:all
npm run validate:data
npm run build
```

## Health check

Once deployed:

`/api/health`

returns freshness, event count, generatedAt, age and collector stats.
