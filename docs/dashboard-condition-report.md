# IRBIS HVAC Dashboard Condition Report

Report date: 2026-07-07

## Executive Summary

The dashboard is currently operational. The production API is healthy, GitHub scheduled refreshes are active again, and the latest code on `main` includes fixes for the stale-date, Today/Yesterday sales, and snapshot validation problems.

Verified production API:

```text
https://irbisapi-production.up.railway.app
```

Verified readiness on 2026-07-07:

```text
ok: true
degraded: false
database: ok
redis: ok
snapshots: ok
latestSnapshotTime: 2026-07-07T12:38:36.785Z
staleThresholdMinutes: 180
```

Latest relevant commits on `main`:

```text
3213f6f Tolerate snapshot validation float noise
ac0c4b0 Fix dashboard snapshot date scoping
809d723 Classify installers by trade fields
95ca8d0 Split field boards by trade and role
aab152e Fix company dashboard goals and sales fallback
```

## Current Operating State

The production project is hosted on Railway. The API is reachable at the Railway URL above and is connected to Railway PostgreSQL and Redis.

The GitHub Actions workflow `Refresh Snapshots` is active and recently produced successful runs. At the time of verification, recent completed scheduled runs included:

```text
28864992723 success 2026-07-07T12:09:16Z duration 29m25s
28853245292 success 2026-07-07T08:41:23Z duration 30m17s
28842958924 success 2026-07-07T05:06:07Z duration 29m0s
28832432189 success 2026-07-07T00:19:40Z duration 28m51s
28828027459 success 2026-07-06T22:37:19Z duration 29m2s
```

The dashboard API returns fresh company-wide payloads for `preset=mtd`, including same-day snapshot timestamps on 2026-07-07.

## Root Causes Of The Recent Issues

### 1. Scheduled refresh was disabled

GitHub had disabled the `Refresh Snapshots` scheduled workflow due to repository inactivity. When the workflow stopped, production snapshots stopped updating. That is why the dashboard showed old June data.

Impact:

- Dashboard freshness froze around the last available snapshot.
- Users saw dates such as Jun 15 even when selecting later dates.
- GitHub Actions showed intermittent historical failures and no reliable refresh cadence.

### 2. Scoped date requests could fall back to stale latest data

The API previously allowed selected date ranges to fall back to the latest stored snapshot when the exact requested scope did not exist yet. This made the dashboard look populated but wrong.

Impact:

- A selected date such as Jun 22 could render a Jun 15 snapshot.
- Users could not tell whether the dashboard was fresh or silently falling back.
- Debugging was harder because the UI looked "complete" while using the wrong scope.

### 3. Today and Yesterday ServiceTitan report ranges used runtime date

Some fixed daily report families used the machine's current date instead of the selected dashboard business date. That made `salesYesterday` vulnerable to off-by-one or stale date behavior when the selected `to` date differed from the refresh runtime.

Impact:

- Yesterday sales could point to the wrong day.
- Today sales could be mixed with MTD display behavior.
- Historical date checks became unreliable.

### 4. Company-wide sales display hid the real daily card

The Company-wide UI could show MTD sales where the stakeholder expected Today. This masked whether the daily `salesToday` family was correct.

Impact:

- The sales card label did not match stakeholder expectation.
- A stale or incorrect daily snapshot was harder to catch visually.

### 5. Some derived models used `new Date()` during rebuild

Monthly pace, capacity, and related read-model logic relied on runtime time in places where it should have used the source snapshot's business date. This can create drift between raw snapshots and derived dashboard models.

Impact:

- Rebuilding the same raw snapshot on a later day could produce a different read model.
- Date-specific dashboard checks were harder to make deterministic.

### 6. Snapshot validation was too strict for numeric round trips

The failed GitHub Actions run showed read-model mismatches only at floating point paths:

```text
callCenterSummary:ytd $.rows[2].cancellationRate
callCenterByCsr:ytd $.rows[2].cancellationRate
salesYesterday:mtd $.totals.weightedCloseRate
```

Those were JavaScript/PostgreSQL JSON numeric precision differences, not real business metric changes.

Impact:

- Good refreshes could still end red.
- Operators could lose trust in GitHub Actions status.
- Real failures were mixed with harmless floating point noise.

### 7. Operational ownership was not documented enough

The project had working code and refresh automation, but lacked a simple owner manual for Railway, GitHub Actions, freshness checks, and incident response.

Impact:

- It was unclear whether red Actions meant broken data, validation noise, or stale scheduling.
- It was unclear where to check Railway, GitHub, ServiceTitan, and snapshot health.
- Preventable operational issues lasted longer than necessary.

## Fixes Already Implemented

### Date scoping fixes

Commit:

```text
ac0c4b0 Fix dashboard snapshot date scoping
```

What changed:

- Report refresh range resolution now uses the selected request context instead of always using runtime date.
- API scoped requests no longer silently fall back to stale latest snapshots.
- If scoped data is missing, the API queues a background refresh and returns an empty scoped model instead of showing stale data.
- Dashboard read models store and use business date ranges.
- The Company-wide sales card now uses the daily `salesToday` model and labels it as Today.
- Monthly pace and related derived models are built against the requested business date.

### Validation fixes

Commit:

```text
3213f6f Tolerate snapshot validation float noise
```

What changed:

- Snapshot validation uses source snapshot and business-date metadata consistently.
- Validation now tolerates tiny numeric round-trip noise.
- Future validation failures should be treated as real metric drift unless proven otherwise.

### Workflow status

The scheduled GitHub Actions workflow is active again. The hourly schedule is:

```text
17 * * * *
```

The workflow writes to the Railway-backed production database and validates snapshots after refresh.

The workflow helper actions were also upgraded to Node 24-compatible versions:

- `actions/checkout@v7`
- `pnpm/action-setup@v6`
- `actions/setup-node@v6`

This addresses the GitHub Actions warning that older action versions targeted the deprecated Node 20 runtime.

## Remaining Risks

Railway deployment details are not committed as code. The repository does not contain Railway service manifests, and the local Railway CLI was not available during this review. The Railway project settings are therefore operational state, not versioned infrastructure.

Recommended action:

- Keep Railway ownership under IRBIS.
- Add clear service names in Railway for web, API, worker, Postgres, and Redis.
- Document the canonical web URL/custom domain in this repo once confirmed.

GitHub Actions can still be disabled by GitHub after prolonged repository inactivity.

Recommended action:

- Add an external reminder or uptime monitor for `/api/health/ready`.
- Review the Actions page weekly.
- Keep failure notifications enabled for the repository.

ServiceTitan refreshes are slow by design because requests are serialized and rate-limit aware.

Recommended action:

- Avoid parallel manual refreshes.
- Treat a 29 to 31 minute refresh duration as normal.
- Investigate only if runs exceed the 90 minute workflow timeout or repeatedly fail on the same report.

Production frontend synthetic checks are still missing.

Recommended action:

- After the canonical Railway web URL is confirmed, add a smoke test that opens `/company-wide?preset=mtd` and verifies the header date, Today sales card, Yesterday sales card, and freshness badge.

## Prevention Plan

1. Monitor health every 5 to 15 minutes:

```bash
curl -sS https://irbisapi-production.up.railway.app/api/health/ready
```

Alert when:

- the request fails
- `ok` is not `true`
- `degraded` is `true`
- `checks.snapshots.ok` is not `true`

2. Monitor GitHub Actions:

- Latest `Refresh Snapshots` run should succeed.
- Runs around 30 minutes are normal.
- Repeated failures need investigation before trusting the dashboard.
- Node runtime deprecation warnings should be treated as maintenance work and cleared before GitHub starts failing old action runtimes.

3. Keep scoped-date behavior strict:

- Do not reintroduce silent fallback from requested dates to latest snapshots.
- Missing scoped data should remain visible as queued/empty until the worker stores the exact requested scope.

4. Keep validation meaningful:

- Tiny numeric precision noise is tolerated.
- Any remaining mismatch path should be investigated as a possible read-model bug.

5. Keep secrets out of Git:

- Railway owns runtime secrets.
- GitHub Actions owns refresh secrets and variables.
- `.env.example` is the only committed reference for variable names.

6. Add operational documentation to each incident:

- Date/time observed.
- Affected dashboard path.
- Selected preset and business date.
- API readiness result.
- Latest workflow run ID.
- Railway service log excerpt.
- ServiceTitan report family if known.

## Owner Checklist

Use this checklist for the next production review:

- Confirm canonical Railway web URL/custom domain.
- Confirm Railway project owner is IRBIS.
- Confirm `it@irbishvac.com` or another IRBIS-owned mailbox has owner/admin access.
- Confirm Railway API, web, worker, Postgres, and Redis services are named clearly.
- Confirm GitHub Actions secrets match Railway production data stores.
- Confirm failure notifications go to an actively monitored IRBIS mailbox or Slack channel.
- Add a production web smoke test once the canonical web URL is finalized.
