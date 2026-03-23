# Target Architecture

## Architectural Choice

- Monorepo: `pnpm` + Turborepo
- Frontend: Next.js App Router in `apps/web`
- Backend API: NestJS in `apps/api`
- Worker / orchestration: BullMQ worker service in `apps/worker`
- Database: PostgreSQL + Prisma in `packages/db`
- Validation: Zod
- Shared business logic: pure TypeScript in `packages/domain`
- External integrations: typed ServiceTitan client and report definitions in `packages/integrations`

NestJS is preferred here because the exported Retool solution is not just page rendering. It has distinct ingestion pipelines, manual goal updates, read APIs, auth, and background orchestration. A dedicated API service with modules and guards is the cleanest long-term split.

## Proposed Monorepo Structure

```text
/
  apps/
    web/
      app/
      components/
      lib/
    api/
      src/
        modules/
        common/
    worker/
      src/
        jobs/
        queues/
  packages/
    config/
    db/
    domain/
    integrations/
    ui/
    utils/
  docs/
  generated/
  exports/
  scripts/
```

## Responsibility Split

### `apps/web`

- Internal dashboard UI only
- Authenticated route shell
- Filter state, typed API calls, rendering
- No business computations beyond view formatting

### `apps/api`

- Dashboard read APIs
- Goal tracker write APIs
- Auth/session endpoints
- Read-model assembly
- Health, freshness, and admin ingestion status endpoints

### `apps/worker`

- Schedules and refresh triggers
- BullMQ processors
- Fetch -> validate -> persist raw -> transform -> persist normalized pipeline
- Retry, idempotency, job status, dead-letter handling

### `packages/domain`

- Metric families extracted from Retool transformers
- Typed DTOs for dashboard responses
- Pure date-range and aggregation functions
- No framework dependencies

### `packages/integrations`

- ServiceTitan OAuth/token client
- Report-definition registry
- External response schemas
- Retry/backoff/error normalization

### `packages/db`

- Prisma schema
- Prisma client
- repositories for raw snapshots, job runs, goals, and normalized read models

### `packages/config`

- Typed environment loading with Zod
- per-environment report IDs, BU IDs, tenant IDs, and storage settings

### `packages/ui`

- Shared reusable dashboard components:
  - `DashboardShell`
  - `TopNavTabs`
  - `DateRangePresetButtons`
  - `KpiCard`
  - `LeaderboardCard`
  - `DonutCard`
  - `ProgressRingCard`
  - `CapacityBars`
  - `TrendingComparisonChart`
  - `GoalTrackerCard`
  - `DataFreshnessBadge`

### `packages/utils`

- Timezone helpers
- money/percent formatting
- correlation IDs
- structured logger helpers

## Ingestion Layer Design

### Report Registry

Create a typed registry keyed by report family, for example:

- `technicians`
- `installers`
- `advisors`
- `call-center-source`
- `call-center-by-csr`
- `call-center-summary`
- `lead-generation`
- `campaigns`
- `trending`
- `marketing`
- `capacity`
- `job-costing-summary`
- `revenue-goals`
- `sales-today`
- `sales-yesterday`
- `sales-monthly-pace`
- `revenue-monthly-pace`
- `booking-rate`

Each registry entry should declare:

- tenant ID
- category
- report ID
- default business unit IDs if applicable
- request parameter builder
- raw payload parser
- storage target
- downstream transformer

### Centralized ServiceTitan Client

Implement `packages/integrations/src/servicetitan/client.ts` with:

- OAuth token retrieval and caching
- typed `fetchReport`
- exponential backoff retries
- retryable rate-limit handling
- correlation IDs
- normalized error objects
- request logging without leaking secrets

### Refresh Pipeline

Each ingestion run follows the same phases:

1. build request params
2. fetch raw ServiceTitan payload
3. validate with Zod
4. persist raw snapshot
5. run typed domain transformer / normalizer
6. persist read-model rows
7. mark ingestion run status and freshness timestamps

## API Layer Design

### Modules

- `auth`
- `dashboard-technicians`
- `dashboard-installers`
- `dashboard-company`
- `dashboard-advisors`
- `dashboard-call-center`
- `dashboard-leads`
- `dashboard-campaigns`
- `dashboard-goals`
- `ingestion-admin`

### Route Shape

- `GET /api/dashboard/technicians`
- `GET /api/dashboard/installers`
- `GET /api/dashboard/company-wide`
- `GET /api/dashboard/advisors`
- `GET /api/dashboard/call-center/summary`
- `GET /api/dashboard/call-center/by-csr`
- `GET /api/dashboard/leads`
- `GET /api/dashboard/campaigns`
- `GET /api/dashboard/trending`
- `GET /api/dashboard/goals`
- `POST /api/dashboard/goals`
- `GET /api/admin/ingestion-runs`
- `POST /api/admin/refresh/:family`

### Service Boundaries

- Controllers only validate input and return DTOs
- Services coordinate repositories and domain functions
- Domain functions remain framework-agnostic
- API responses include freshness metadata and source snapshot timestamps

## Frontend Module Structure

### Routes

- `/technicians`
- `/installers`
- `/company-wide`
- `/advisors`
- `/call-center/summary`
- `/call-center/by-csr`
- `/leads`
- `/campaigns`

### Frontend Principles

- Shared dashboard chrome and filter bar
- Server components for initial data fetch where practical
- client components only for interactivity and chart rendering
- no business logic in page components
- all KPI cards and chart props consume typed API DTOs
- replace HTML widgets with React components preserving current rank order, card prominence, and labels

## Job Orchestration Design

### Queues

- `retool-replacement-refresh`
- `retool-replacement-transform`
- `retool-replacement-maintenance`

### Logical Pipelines

- `people-refresh`
  - technicians
  - installers
  - advisors
  - call-center source
  - call-center by-csr
  - call-center summary
  - lead generation
  - campaigns
  - trending
- `company-refresh`
  - marketing
  - capacity
  - job costing summary
  - revenue-goals feed
  - sales today
  - sales yesterday
  - sales monthly pace
  - revenue monthly pace
  - booking rate

### Wait Replacement

Retool’s arbitrary waits should be replaced with deterministic behavior:

- request hash + family + business date idempotency keys
- explicit fetch completion tracking
- optional polling for asynchronous report readiness if ServiceTitan requires it
- bounded retries with backoff
- DLQ / failed run visibility

## Raw Vs Normalized Storage Strategy

### Raw

- keep one raw snapshot record per ingestion request
- store:
  - report family
  - request params
  - response payload JSON
  - fetched at
  - source snapshot timestamp if present
  - request hash / idempotency key

### Normalized

- write targeted read models for page-level consumers
- examples:
  - `technician_metric_snapshot`
  - `installer_metric_snapshot`
  - `advisor_metric_snapshot`
  - `call_center_summary_snapshot`
  - `call_center_agent_snapshot`
  - `lead_generation_snapshot`
  - `campaign_snapshot`
  - `marketing_breakdown_snapshot`
  - `capacity_snapshot`
  - `sales_summary_snapshot`
  - `pace_snapshot`
  - `trending_snapshot`

### Why Both

- raw snapshots preserve auditability and parity debugging
- normalized tables make dashboard APIs predictable, indexed, and testable
- reprocessing can rebuild normalized tables from raw snapshots when transformer logic changes

## Auth Strategy

- Internal-only auth scaffold
- Prisma-backed users, sessions, and role enum:
  - `ADMIN`
  - `MANAGER`
  - `VIEWER`
- Cookie-based session auth
- API guards enforce route-level access
- Web middleware redirects anonymous users to sign-in

## Testing Strategy

### Unit

- all metric functions in `packages/domain`
- timezone/date helper edge cases
- transformation of raw ServiceTitan rows into dashboard DTOs

### Integration

- ServiceTitan client request construction
- ingestion services with mocked HTTP responses
- repository read/write flows

### API

- major dashboard routes
- goal tracker upsert route
- auth guard coverage

### E2E / Smoke

- Playwright smoke coverage for the 8 main screens
- basic auth login flow
- page load + date preset + rendered primary KPI assertions

## Deployment Strategy

- Containerized deployment for `api` and `worker`
- Managed PostgreSQL
- Managed Redis for BullMQ
- `web` can deploy with the same platform or separately if desired

Recommended default:

- `apps/web`: Next.js deployment target with environment-driven API base URL
- `apps/api`: long-running NestJS container
- `apps/worker`: long-running BullMQ container
- shared observability and environment management across all three

This avoids forcing background jobs into a serverless runtime and keeps ingestion, retries, and API latency isolated.

## Observability And Error Handling

- structured JSON logs with correlation IDs
- one correlation ID per request and per ingestion run
- Sentry-ready hooks in all apps
- ingestion run tables with status, duration, and error summary
- freshness endpoint per dashboard family
- failed job alerting / DLQ inspection
- explicit redaction of secrets in logs

