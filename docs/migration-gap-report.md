# Migration Gap Report

## Migrated With High Confidence

- Page inventory:
  - 8 exported pages were identified and recreated as route targets in `apps/web`
- Workflow inventory:
  - 2 ingestion workflows were mapped into worker pipeline families
- External endpoints:
  - 11 ServiceTitan report endpoints were extracted from page/workflow exports
- Secrets externalization:
  - ServiceTitan client ID, client secret, app key, tenant ID, and known report IDs were moved into `.env.example`
- Raw snapshot strategy:
  - raw snapshots, ingestion runs, job runs, refresh schedules, goal entries, and read models are defined in Prisma
- Business logic extraction:
  - technician
  - installer
  - advisor
  - call-center
  - lead-generation
  - campaign
  - marketing donut
  - booking rate
  - capacity
  - sales summary
  - sales monthly pace
  - revenue monthly pace
  - revenue goal summary
  - trending model
- Backend routes scaffolded:
  - technicians
  - installers
  - company-wide
  - advisors
  - call-center summary
  - call-center by CSR
  - leads
  - campaigns
  - trending
  - goals
- Frontend routes scaffolded:
  - `/company-wide`
  - `/technicians`
  - `/installers`
  - `/advisors`
  - `/call-center/summary`
  - `/call-center/by-csr`
  - `/leads`
  - `/campaigns`

## Inferred During Migration

- `page3` company-wide widgets were translated into structured React sections instead of HTML-string generation:
  - marketing breakdown
  - capacity
  - goal tracker cards
  - trending table
- `DashboardReadModel` was introduced as the normalized/report-ready layer even though Retool only stored raw snapshots.
- NestJS + BullMQ was selected as the primary runtime split because the exported workflows imply long-running orchestration and internal APIs.
- The new frontend now uses 3 explicit layout families based on the export:
  - dense leaderboard grid pages
  - company-wide dashboard composition
  - call-center summary KPI grid
- `buildSalesMonthlyPace` uses the explicit page-request behavior with a month-start offset matching the exported query body rather than the contradictory fallback-comment wording.
- A Retool Postgres sync path was added so the local app can seed real snapshots from the live `st_*` tables and avoid invented data or empty states while ServiceTitan mappings are still being finalized.
- Live Retool DB validation closed the main company-wide and call-center semantic gaps:
  - `st_per_csr` / `st_per_summary` store `CanceledBeforeDispatch` and `CancellationRate`
  - `page6` summary is aggregate-only and excludes only the `"abandoned"` row from averages
  - `page3` mixes filter-scoped widgets with fixed-scope widgets rather than applying one shared date range to every card
- User-provided ServiceTitan report URLs closed the final unresolved company-wide endpoint mappings:
  - capacity -> `business-unit-dashboard / 111298433`
  - job costing summary -> `operations / 27381966`
  - revenue goals -> `business-unit-dashboard / 216`
- `page3` fixed-scope widget rules are now explicit in the migration:
  - capacity, booking rate, and sales today always use LA `today`
  - sales yesterday always uses LA `yesterday`
  - job costing summary, sales monthly pace, and revenue monthly pace use current-month day `2` through selected `To`
  - revenue goal tracker uses current-year day `2` through LA `today`

## Still Ambiguous From Exports

- Call-center table naming is inconsistent:
  - `page6` summary reads `st_per_csr`
  - `page7` by-CSR reads `st_per_summary`
- The live Retool DB confirms both call-center tables share the same stored field set; what remains ambiguous is only which page should be treated as the canonical source name, not the actual metric columns.
- `st_csr` is written by workflow but unused by the exported pages.
- Workflow timezone metadata is `Asia/Shanghai`, while all meaningful business date logic uses `America/Los_Angeles`.
- The trending widget still hardcodes `2024` and `2025` overlays in the exported HTML/SQL transformer even though current raw rows include newer years.

## Validate Against Live Retool Outputs

- Company-wide page:
  - visual parity of panel sizing and density against the Retool composition
  - capacity per-BU target overrides, if they were only configured through browser globals rather than persisted export state
- Call center pages:
  - confirm whether the current page naming should be normalized or preserved despite the `st_per_csr` / `st_per_summary` table-name mismatch
- Trending:
  - confirm hardcoded 2024/2025 overlay still matches current intended behavior
  - confirm goal overlay and chart scaling match current live output
- Asset matching:
  - verify technician photos and logos are still named/formatted to match the Retool Storage lookup behavior
- Auth:
  - session creation is scaffolded but not production-complete until cookie issuance and guard wiring are finalized in the deployment environment
