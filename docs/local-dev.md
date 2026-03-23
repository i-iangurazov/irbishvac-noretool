# Local Dev Infra

The repo includes [docker-compose.yml](/Users/ilias_iangurazov/Commercial/irbishvac-noretool/docker-compose.yml) for local PostgreSQL and Redis.

Use the local stack:

```bash
pnpm db:up
pnpm db:generate
pnpm db:push
pnpm retool:sync
pnpm dev
```

For a single command that prepares local infra and syncs the latest available snapshots:

```bash
pnpm sync:local
```

To fill your own snapshot tables directly from ServiceTitan instead of importing Retool-backed data:

```bash
pnpm refresh:latest
pnpm snapshots:validate
```

Useful commands:

```bash
pnpm db:ps
pnpm db:logs
pnpm db:down
pnpm retool:sync
pnpm sync:local
pnpm refresh:latest
pnpm snapshots:validate
```

Expected local env values:

```dotenv
WORKER_BOOTSTRAP_ON_START=false
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/irbishvac_retool
RETOOL_DATABASE_URL=
REDIS_URL=redis://localhost:6379
```

If your `.env` points somewhere else, `pnpm dev` will keep using that instead of the compose services.

`pnpm retool:sync` imports the latest live Retool `st_*` snapshots into the local Prisma tables. That is the fastest way to get real parity data locally without waiting on ServiceTitan refreshes.

`WORKER_BOOTSTRAP_ON_START=false` keeps local dev from immediately hammering ServiceTitan on boot. Set it to `true` only when you want the worker to enqueue refresh pipelines automatically.

`pnpm refresh:latest` calls ServiceTitan directly and fills the local snapshot/read-model tables for both `MTD` and `YTD` page scopes. The script runs sequentially, respects the one-minute limiter, and retries when ServiceTitan returns a `429`.

If some ServiceTitan report mappings are still unresolved in env config, `pnpm refresh:latest` will fail intentionally. That is the correct behavior for production refreshes.

`pnpm snapshots:validate` rebuilds read models from the latest raw snapshots and fails if any stored derived payload no longer matches the current domain logic.

`pnpm sync:local` now runs a hybrid bootstrap:

1. starts local Postgres and Redis
2. generates Prisma client
3. pushes the Prisma schema
4. attempts to import Retool parity snapshots when `RETOOL_DATABASE_URL` is configured
5. refreshes the latest directly resolvable ServiceTitan snapshots
6. validates the derived dashboard payloads

When `RETOOL_DATABASE_URL` is present, `pnpm sync:local` automatically sets `SKIP_UNRESOLVED_REPORTS=true` for the direct refresh step so unresolved families do not fail the whole local bootstrap.

If the Retool database is unreachable, `pnpm sync:local` now warns and continues with direct ServiceTitan refreshes instead of aborting the whole local bootstrap.

After it completes, start the app with `pnpm dev`.
