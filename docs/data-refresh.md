# Snapshot Refresh Flow

The app now supports two independent refresh paths:

1. `pnpm retool:sync`
Imports the latest Retool-backed `st_*` tables into local raw/read-model storage for quick parity checks.

2. `pnpm refresh:latest`
Calls ServiceTitan directly and stores fresh raw snapshots plus derived dashboard read models in the app database.

For local development bootstrap, use:

3. `pnpm sync:local`
Starts local infra, applies the Prisma schema, optionally imports Retool parity snapshots when `RETOOL_DATABASE_URL` is configured, runs the direct ServiceTitan refresh, and validates the resulting snapshots.

## Scope coverage

`refresh:latest` builds a deduped plan across all dashboard families and both user-facing filter presets:

- `MTD`
- `YTD`

Families whose range resolver collapses to a fixed scope, such as `today` or `yesterday`, are deduped by request hash so they are not fetched twice unnecessarily.

## Rate-limit handling

- Direct refresh runs sequentially.
- The worker queue stays globally limited to one job per 65 seconds.
- Direct refresh retries ServiceTitan `429` responses after the reported wait window plus a small buffer.
- When `SKIP_UNRESOLVED_REPORTS=true`, direct refresh skips report families whose category/report IDs are still unresolved in env config. This is intended for local hybrid syncs only.

## Correctness guard

`pnpm snapshots:validate` rebuilds each latest read model from its raw snapshot and compares the result to the stored derived payload. This catches drift between:

- ingestion payloads
- domain metric builders
- persisted dashboard read models

## Scheduled automation

GitHub Actions workflow:

- [refresh-snapshots.yml](/Users/ilias_iangurazov/Commercial/irbishvac-noretool/.github/workflows/refresh-snapshots.yml)

It supports:

- hourly scheduled refreshes
- manual dispatch
- validation immediately after refresh

## Local hybrid sync behavior

If `RETOOL_DATABASE_URL` is configured, `pnpm sync:local` now runs in hybrid mode:

1. attempts to import the latest Retool-backed parity snapshots for all known `st_*` tables
2. refreshes the directly resolvable ServiceTitan families
3. skips unresolved direct ServiceTitan families instead of failing the whole local bootstrap
4. validates the final local raw/read-model state

If the Retool database is unreachable, the import step becomes a warning and the bootstrap continues with direct ServiceTitan refreshes.
