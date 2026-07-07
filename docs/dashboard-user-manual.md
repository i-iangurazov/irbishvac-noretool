# IRBIS HVAC Dashboard User Manual

Last updated: 2026-07-07

## Purpose

The IRBIS HVAC dashboard replaces the Retool dashboard with a Railway-hosted web app, API, worker, PostgreSQL database, and Redis queue/cache. The dashboard reads ServiceTitan reports, stores normalized snapshots, and renders leadership and operations views from those stored read models.

## Production Ownership

The production project is hosted on Railway. Keep the web service, API service, worker service, PostgreSQL database, and Redis instance inside the IRBIS-owned Railway project.

The verified production API is:

```text
https://irbisapi-production.up.railway.app
```

The web dashboard should be opened through the Railway web service URL or custom domain assigned to `apps/web`. The root page redirects to:

```text
/company-wide
```

The web service must set `API_BASE_URL` to the Railway API service URL so browser page requests can proxy dashboard API calls correctly.

Operations pages are built into the same web app:

```text
/ops
/ops/user-manual
/ops/condition-report
```

## Dashboard Pages

Use the menu button in the dashboard header to move between views.

| Page | Path | Purpose |
| --- | --- | --- |
| Company-wide | `/company-wide` | Revenue, sales, goals, marketing, booking rate, capacity, gross margin, and trends. |
| HVAC Service | `/technicians` | HVAC service technician leaderboard. |
| Plumbing Service | `/plumbing` | Plumbing service technician leaderboard. |
| Electrical Service | `/electrical` | Electrical service technician leaderboard. |
| HVAC Install | `/installers` | HVAC installer leaderboard. |
| Plumbing Install | `/plumbing-install` | Plumbing install leaderboard. |
| Electrical Install | `/electrical-install` | Electrical install leaderboard. |
| Advisors | `/advisors` | Comfort advisor leaderboard. |
| Call Center Summary | `/call-center/summary` | Call center KPI summary. |
| Call Center By CSR | `/call-center/by-csr` | CSR-level call center metrics. |
| Lead Generation | `/leads` | Lead source performance. |
| Campaigns | `/campaigns` | Campaign performance. |

## Filters And Display Modes

The dashboard supports these URL parameters:

| Parameter | Example | Meaning |
| --- | --- | --- |
| `preset` | `preset=mtd` or `preset=ytd` | Selects month-to-date or year-to-date. Defaults to `mtd`. |
| `from` | `from=2026-07-01` | Explicit start date. Used with `to`. |
| `to` | `to=2026-07-07` | Explicit business date/end date. Used with `from`. |
| `tv` | `tv=1` | Enables TV layout. |
| `kiosk` | `kiosk=1` | Hides extra navigation controls for a display screen. |
| `rotate` | `rotate=1` | Rotates through field leaderboard boards in TV mode. |
| `boards` | `boards=technicians,installers` | Limits rotation to selected field boards. |

Examples:

```text
/company-wide?preset=mtd
/company-wide?preset=ytd
/technicians?preset=mtd&tv=1
/technicians?preset=mtd&tv=1&kiosk=1&rotate=1
/company-wide?preset=mtd&from=2026-07-01&to=2026-07-07
```

## Data Freshness

Each dashboard uses stored ServiceTitan snapshots. The green freshness badge shows the snapshot timestamp used by the view. The API readiness check treats snapshots older than 180 minutes as stale.

Check production readiness:

```bash
curl -sS https://irbisapi-production.up.railway.app/api/health/ready
```

Healthy output should have:

```text
ok: true
degraded: false
checks.database.ok: true
checks.redis.ok: true
checks.snapshots.ok: true
```

If `degraded` is `true`, the API is running but dashboard snapshots are missing or stale. Check the refresh workflow and worker logs.

## Refresh Workflow

Fresh data is produced by the GitHub Actions workflow:

```text
.github/workflows/refresh-snapshots.yml
```

Schedule:

```text
17 * * * *
```

That means the refresh starts every hour at minute 17 UTC. A normal run currently takes about 29 to 31 minutes because ServiceTitan report pulls are serialized to respect rate limits.

The workflow runs:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm sync:remote
```

`pnpm sync:remote` imports Retool parity data when configured, refreshes the latest ServiceTitan snapshots, rebuilds dashboard read models, and validates stored snapshots.

## Manual Refresh

Use this when the dashboard is stale, a ServiceTitan report was corrected, or a selected date range needs to be filled.

1. Open GitHub Actions for this repo.
2. Select `Refresh Snapshots`.
3. Click `Run workflow`.
4. Wait for completion. A normal run can take 30 minutes.
5. Re-check:

```bash
curl -sS https://irbisapi-production.up.railway.app/api/health/ready
```

For a configured local or Railway shell, the equivalent command is:

```bash
pnpm refresh:latest
pnpm snapshots:validate
```

Do not run refresh commands repeatedly in parallel. The workflow has concurrency protection, and the worker uses a one-job limiter to avoid ServiceTitan rate-limit failures.

The worker retries retryable ServiceTitan report fetch failures, including `408`, `425`, `5xx`, and network-level fetch errors. It does not retry permanent configuration or authorization errors such as `400`, `401`, `403`, or `404`.

## Railway Services

Keep these services in the IRBIS Railway project:

| Service | Source | Required environment |
| --- | --- | --- |
| Web | `apps/web` | `NEXT_PUBLIC_APP_NAME`, `API_BASE_URL` pointing to the Railway API URL. |
| API | `apps/api` | `DATABASE_URL`, `REDIS_URL`, auth variables, ServiceTitan variables, report mapping variables. |
| Worker | `apps/worker` | Same database, Redis, ServiceTitan, report mapping, and asset variables as the API. |
| PostgreSQL | Railway managed database | Used by API, worker, and GitHub Actions refresh. |
| Redis | Railway managed Redis | Used by API readiness checks and worker queue coordination. |

Do not put production secrets in committed files. Store them in Railway variables and GitHub Actions secrets/variables.

## Required Variables

Use `.env.example` as the safe reference for names. Production values belong in Railway and GitHub, not in Git.

Core variables:

```text
NODE_ENV=production
APP_TIMEZONE=America/Los_Angeles
DATABASE_URL
REDIS_URL
AUTH_COOKIE_SECRET
AUTH_DEFAULT_ADMIN_EMAIL
AUTH_DEFAULT_ADMIN_PASSWORD
NEXT_PUBLIC_APP_NAME
API_BASE_URL
SERVICETITAN_CLIENT_ID
SERVICETITAN_CLIENT_SECRET
SERVICETITAN_APP_KEY
SERVICETITAN_TENANT_ID
ST_REPORT_*
ST_BU_*
R2_*
ASSET_FOLDER_*
```

GitHub Actions must have the same production database, Redis, ServiceTitan, and report mapping values so scheduled refreshes write to the same Railway-backed data store as the live dashboard.

## Managing Goals

The Company-wide page has a goal insert control. Use it to update the monthly revenue goal for the selected month/year. After saving, refresh the page and confirm the Goal Tracker and Trend vs Goal views use the new target.

If goal values look wrong:

1. Confirm the selected date in the header.
2. Confirm the month/year was saved for that same business month.
3. Check the API response for `/api/dashboard/company-wide?preset=mtd`.
4. Check Railway API logs for goal write errors.

## Troubleshooting

Dashboard shows an old date:

1. Check `/api/health/ready`.
2. Check the latest `Refresh Snapshots` workflow run.
3. If GitHub Actions says the workflow is disabled, re-enable it and run it manually.
4. If a selected historical date has no data yet, the API queues a background refresh and the page will populate after the worker stores that scoped snapshot.

GitHub Actions is red but the refresh logs show reports completed:

1. Look at the validation error paths.
2. If paths point to real metrics, investigate the related domain metric builder.
3. Tiny floating point round-trip differences are now tolerated by validation, so new failures should be treated as real drift.

Dashboard page says data is queued:

1. Leave the selected URL unchanged.
2. Wait for the worker refresh to complete.
3. Reload the page.
4. If it stays empty, check Railway worker logs and the GitHub workflow run.

ServiceTitan returns rate-limit errors:

1. Do not start another refresh.
2. Let the current run finish. The worker waits and retries `429` responses.
3. If repeated runs fail, reduce manual refresh frequency and check ServiceTitan API availability.

ServiceTitan returns `500` timeout errors:

1. Do not start another refresh immediately.
2. Check whether the workflow logs show retry attempts for the failed report family.
3. If retry succeeds, treat the run as recovered.
4. If the same report fails after all retries across multiple runs, treat it as a ServiceTitan upstream incident and preserve the run ID, report family, and error body excerpt.

API readiness is unavailable:

1. Check Railway API service status.
2. Check Railway Postgres and Redis services.
3. Confirm API variables are present.
4. Redeploy the API service if the last deployment failed.

## Release Checklist

Before pushing dashboard code changes:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

After pushing to `main`:

1. Confirm Railway deployed the changed service.
2. Confirm the API health endpoint is ready.
3. Run or wait for `Refresh Snapshots`.
4. Open `/company-wide?preset=mtd`.
5. Confirm the header date, Today sales, Yesterday sales, and freshness badge all match the expected business date.
