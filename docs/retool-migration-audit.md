# Retool Migration Audit

## Audit Basis

- Source of truth:
  - `IRBIS%20HVAC%20Dashboards%20Final%20Draft.json`
  - `IRBIS%20HVAC%20Dashboards%20Final%20Draft.zip`
  - `Final flow for tech and installers (2).json`
  - `ST Metrics Refresh (3).json`
- Generated inventory:
  - `scripts/extract-retool-inventory.mjs`
  - `generated/retool-inventory.json`
- Retool app export contains 8 screens, 2 workflows, 19 persisted snapshot tables/manual tables, 11 distinct ServiceTitan report endpoints, 10 HTML widgets, 2 CSS files, and a shared LA-business-date assumption across page logic.

## Pages

| Page ID | Title | Queries / Data Sources | UI / Layout Notes |
| --- | --- | --- | --- |
| `page1` | Service Technician Dashboard (HVAC - SERVICE) | `getToken`, `getTechnicianReport`, `query2`, `holdForOneMinute`, `query7`, `query9` | Shared top nav, logo, two date inputs, `YTD` and `MTD` presets, ranked technician HTML card grid in `html6.html`, Retool Storage headshot lookup. |
| `page2` | INSTALLER Dashboard - HVAC INSTALL | `getInstallerReport`, `getToken3`, `query4`, `query11` | Same nav/filter pattern as page 1, installer leaderboard HTML widget in `html7.html`, default BU filter `[1809, 64313020]`. |
| `page3` | Company-wide Dashboard | `getToken2`, `getMarketing`, `getCapacity`, `getSalesMonthlyPace`, `getRevenueMonthlyPace`, `getBookingRate`, `getJobCostingSummary`, `getGoalTracker`, `query19`, `getSales2`, `getSales`, SQL fallback reads, `goalTrackerDB`, `getGoalTrackerDB`, `query12`, `monthMap`, `query6` workflow trigger | Most complex page. Shared nav + date presets, one Recharts-like Retool chart, four HTML widgets (`html1`, `html5`, `html3`, `html4`), one goal drawer (`drawerFrame1.rsx`), one marketing chart container, one capacity container, manual goal entry flow. |
| `page4` | Comfort Advisors Board | `getAdvisorsData`, `getToken4`, `getAdvisors`, `query13` | Shared nav/filter pattern, advisor leaderboard HTML widget in `html8.html`, default BU filter `[1812, 64326403, 64567559]`. |
| `page6` | Call Center Performance Summary | `getToken6`, `getCSRData2`, `getCSR2`, `query15` | Shared nav/filter pattern, summary metric widget in `html14.html`. |
| `page7` | Call Center Performance by CSR | `getToken7`, `getCSRData3`, `getCSR3`, `query16` | Shared nav/filter pattern, CSR leaderboard widget in `html11.html`. |
| `page8` | Lead Generation | `getToken8`, `getCSRData4`, `getCSR4`, `query17` | Shared nav/filter pattern, lead-generation leaderboard widget in `html12.html`, default BU filter `[1809, 1810, 1812, 64313020, 64315277, 64326403, 64567559, 64569092, 64569731]`. |
| `page9` | Campaign Summary Report | `getToken9`, `getCSRData5`, `getCSR5`, `query18` | Shared nav/filter pattern, campaign leaderboard widget in `html13.html`. |

## Navigation And Repeated Layout Patterns

- Every page uses the same Retool `Navigation` component bound to `retoolContext.pages`.
- Every page shows the same top logo image from Retool Storage.
- Seven of eight pages use the same pattern:
  - start date input
  - end date input
  - `YTD` button
  - `MTD` button
  - a single HTML widget that renders the ranked cards or summary view
- `page3` extends the pattern with:
  - a marketing donut chart
  - trending widget
  - sales today/yesterday widget
  - YTD goal tracker
  - gross margin goal tracker
  - capacity view
  - manual goal insertion drawer
- Time defaults and button logic are LA-business-date driven, not browser-local.

## Workflows

### `Final flow for tech and installers`

- Trigger: webhook `startTrigger`
- Workflow metadata timezone: `Asia/Shanghai`
- Actual date logic in queries: `America/Los_Angeles`
- Chain:
  1. `ST_getToken`
  2. `workflow1` wait for `1` second
  3. `getTechnicianReport` -> `populateTechnicianReport` -> `st_technician`
  4. `getInstallerReport` -> `populateInstallerReport` -> `st_installer`
  5. `getAdvisors` -> `populateAdvisors` -> `st_advisors`
  6. `wait1` for `70` seconds
  7. `getCSR` -> `populateCSR` -> `st_csr`
  8. `getPerformanceCSR` -> `populatePerformanceCSR` -> `st_per_csr`
  9. `wait2` for `70` seconds
  10. `getPerformanceSummary` -> `populatePerformanceSummary` -> `st_per_summary`
  11. `getLead` -> `populateLead` -> `st_lead`
  12. `wait3` for `70` seconds
  13. `getCampaign` -> `populateCampaign` -> `st_campaign`
  14. `getTrending` -> `populateTrending` -> `st_trending`

### `ST Metrics Refresh`

- Trigger: webhook `startTrigger`
- Workflow metadata timezone: `Asia/Shanghai`
- Actual date logic in queries: `America/Los_Angeles`
- Chain:
  1. `ST_getToken`
  2. `getMarketing` -> `populateMarketing` -> `st_marketing`
  3. `getCapacity` -> `populateCapacity` -> `st_capacity`
  4. `getJobCostingSummary` -> `populateJobCostingSummary` -> `st_job_costing_summary`
  5. `getGoalTracker` -> `populateGoalTracker` -> `st_revenue`
  6. `wait1` for `70` seconds
  7. `getSales` -> `populateSales` -> `st_sales`
  8. `wait2` for `70` seconds
  9. `getSalesMonthlyPace` -> `populateSalesMonthlyPace` -> `st_sales_monthly_pace`
  10. `wait3` for `70` seconds
  11. `getBookingRate` -> `populateBookingRate` -> `st_booking_rate`
  12. `wait4` for `70` seconds
  13. `getSales2` -> `populateSales2` -> `st_sales_yes`
  14. `wait5` for `70` seconds
  15. `getRevenueMonthlyPace` -> `populateSales3` -> `st_revenue_monthly_pace`

### Workflow Observations

- Both workflows are effectively ingestion pipelines, not user-facing automation.
- The Retool wait blocks are not tied to explicit status polling. They are arbitrary time delays.
- All workflow persistence writes raw JSON snapshots into Retool DB tables.
- The workflows reuse a shared OAuth token acquisition step.

## External Endpoints Discovered

All discovered external endpoints point at ServiceTitan reporting APIs for tenant `686965608`.

| Report Family | Category | Report ID | Endpoint |
| --- | --- | --- | --- |
| Technician dashboard | `technician` | `66109112` | `https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/technician/reports/66109112/data` |
| Installer dashboard | `technician-dashboard` | `112224016` | `https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/technician-dashboard/reports/112224016/data` |
| Advisors board | `operations` | `80249474` | `https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/operations/reports/80249474/data` |
| Call center / CSR source | `operations` | `6771127` | `https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/operations/reports/6771127/data` |
| Call center performance | `operations` | `116192131` | `https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/operations/reports/116192131/data` |
| Lead generation | `business-unit-dashboard` | `219` | `https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/business-unit-dashboard/reports/219/data` |
| Campaigns / marketing summary | `marketing` | `898` | `https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/marketing/reports/898/data` |
| Booking rate | `marketing` | `930` | `https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/marketing/reports/930/data?pagesize=100` |
| Trending | `other` | `115808515` | `https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/other/reports/115808515/data` |
| Sales / company-wide totals | `business-unit-dashboard` | `228` | `https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/business-unit-dashboard/reports/228/data` |
| Revenue monthly pace | `operations` | `111413515` | `https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/operations/reports/111413515/data` |
| Capacity | `business-unit-dashboard` | `111298433` | `https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/business-unit-dashboard/reports/111298433/data` |
| Job costing summary | `operations` | `27381966` | `https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/operations/reports/27381966/data` |
| Revenue goals / goal tracker | `business-unit-dashboard` | `216` | `https://api.servicetitan.io/reporting/v2/tenant/686965608/report-category/business-unit-dashboard/reports/216/data` |

## DB Tables Discovered

### Snapshot / Raw Tables

- `st_technician`
- `st_installer`
- `st_advisors`
- `st_csr`
- `st_per_csr`
- `st_per_summary`
- `st_lead`
- `st_campaign`
- `st_trending`
- `st_marketing`
- `st_capacity`
- `st_job_costing_summary`
- `st_revenue`
- `st_sales`
- `st_sales_yes`
- `st_sales_monthly_pace`
- `st_revenue_monthly_pace`
- `st_booking_rate`

### Manual / Supporting Tables

- `st_goal_tracker`

### Table Usage Notes

- Page SQL reads use `ORDER BY snapshot_time DESC LIMIT 1` almost everywhere.
- `st_goal_tracker` is the only manual write table in the app export itself.
- `st_csr` is written by workflow but not read by any page SQL query in the exported app. It looks like a legacy or intermediate table.
- `st_revenue` is populated by workflow step `populateGoalTracker`; the naming is misleading and must be normalized during migration.

## Retool Transformers

### Service Technician Dashboard

| Query ID | Source | What It Computes |
| --- | --- | --- |
| `getTechnicianReport` | REST | Normalizes technician rows, computes total influenced revenue, leaderboard ranking, weighted close-rate totals, weighted average sale from opportunities, membership conversion, optional extras such as commission, callback rate, completed jobs, headshots. |
| `query2` | SQL fallback | Same technician semantics as `getTechnicianReport`, but sourced from latest `st_technician` snapshot. |

### Installer Dashboard

| Query ID | Source | What It Computes |
| --- | --- | --- |
| `getInstallerReport` | REST | Normalizes installer revenue rows, computes installed revenue, jobs completed, recalls caused, billable efficiency, average install, ranking, weighted billable-efficiency average, total installed revenue, and leader fields. |
| `query4` | SQL fallback | Same installer semantics as `getInstallerReport`, but sourced from latest `st_installer` snapshot. |

### Company-wide Dashboard

| Query ID | Source | What It Computes |
| --- | --- | --- |
| `getMarketing` | REST | Marketing donut aggregation grouped by campaign/category, top-N bucketing, compact currency label rendering for donut labels. |
| `getMarketingDB` | SQL fallback | Same marketing donut semantics using latest `st_marketing` snapshot. |
| `getCapacity` | REST | Capacity-by-business-unit rollup from daily rows. Export body hardcodes LA `today` for both `From` and `To`, so this widget is fixed-scope and does not follow the page `MTD` / `YTD` filter. |
| `getCapacityDB` | SQL fallback | Daily capacity-by-business-unit fallback from `st_capacity`. |
| `getSalesMonthlyPace` | REST | Monthly sales pace projection using LA business date, MTD total sales, days-in-month, days-past logic, compact currency formatting. Export body fixes `From` to day `2` of the current month and only uses the page `To` picker for the end date. |
| `getSalesMonthlyPaceDB` | SQL fallback | Same sales monthly pace projection from `st_sales_monthly_pace`, with explicit LA guards and multiplier metadata. |
| `getRevenueMonthlyPace` | REST | Sum of `CurrentMonthlyPace`, formatted as compact currency. Export body fixes `From` to day `2` of the current month and uses the page `To` picker only for the end date. |
| `getRevenueMonthlyPaceDB` | SQL fallback | Same revenue monthly pace semantics from `st_revenue_monthly_pace`. |
| `getBookingRate` | REST | Booked-vs-leads calculation for booking-rate KPI family. Export body hardcodes LA `today` for both `From` and `To`, so this card is fixed-scope. |
| `getBookingRateDB` | SQL fallback | Same booked-vs-leads semantics from `st_booking_rate`. |
| `getJobCostingSummary` | REST | Gross-margin/job-costing summary with monthly goal, MTD, remaining-to-goal, date parsing, and fixed goal-tracker inputs. Export body fixes `From` to day `2` of the current month and uses the page `To` picker only for the end date. |
| `getJobCostingSummaryDB` | SQL fallback | Same job-costing summary from `st_job_costing_summary`. |
| `getGoalTracker` | REST | Revenue/goal tracker normalization: group totals, total revenue, total sales, daily goal fields, yearly pace, monthly pace, progress values. Export body fixes `From` to day `2` of the current year and `To` to LA `today`, so this widget remains YTD even when the page is switched to `MTD`. |
| `getRevenueDB` | SQL fallback | Same revenue/goal tracker semantics from `st_revenue`. |
| `getSales` | REST | Company sales summary for current-day range: total sales, total revenue, close metrics, opportunities, options per opportunity, adjustment revenue, non-job revenue, and grouped totals. This widget is fixed to LA `today`. |
| `getSalesDB` | SQL fallback | Same company sales summary from `st_sales`. |
| `getSales2` | REST | Yesterday comparison slice for sales summary. This widget is fixed to LA `yesterday`. |
| `getSalesDB2` | SQL fallback | Yesterday comparison fallback from `st_sales_yes`. |
| `getTrending` | SQL read | Merges latest `st_trending` payload with manual `st_goal_tracker` rows, prepares chart HTML/Y-axis/goal overlay data for the trending widget. The exported SQL/HTML still hardcode 2024 vs 2025 overlays even though current raw tables now contain later years. |
| `query19` | REST | Fetches trending raw report data before it is snapshotted into `st_trending`. |
| `goalTrackerDB` | SQL write | Upserts monthly goal values into `st_goal_tracker`. |
| `getGoalTrackerDB` | SQL read | Reads manual monthly goals in month order. |

### Comfort Advisors Board

| Query ID | Source | What It Computes |
| --- | --- | --- |
| `getAdvisorsData` | REST | Advisor performance board ranked by total sales, with opportunity counts and leaderboard card-friendly fields. |
| `getAdvisors` | SQL fallback | Same advisor board semantics from `st_advisors`. |

### Call Center Performance Summary

| Query ID | Source | What It Computes |
| --- | --- | --- |
| `getCSRData2` | REST | Call-center performance summary keyed around leads received, inbound/manual jobs booked, total jobs booked, call booking rate, cancelled-before-dispatch, and cancellation rate. |
| `getCSR2` | SQL fallback | Same summary semantics from `st_per_csr`. Live Retool DB inspection confirms the stored fields include `CanceledBeforeDispatch` and `CancellationRate`. |

### Call Center Performance By CSR

| Query ID | Source | What It Computes |
| --- | --- | --- |
| `getCSRData3` | REST | CSR leaderboard rows and ranking keyed around leads received, inbound/manual calls booked, total jobs booked, call booking rate, cancelled-before-dispatch, and cancellation rate. |
| `getCSR3` | SQL fallback | Same CSR leaderboard semantics from `st_per_summary`; the table name remains misleading, but live Retool DB inspection confirms the stored schema matches the page widget fields. |

### Lead Generation

| Query ID | Source | What It Computes |
| --- | --- | --- |
| `getCSRData4` | REST | Lead-generation-by-team rows: leads generated, good leads, booked leads, booking rate, ranking. |
| `getCSR4` | SQL fallback | Same lead-generation semantics from `st_lead`. |

### Campaign Summary Report

| Query ID | Source | What It Computes |
| --- | --- | --- |
| `getCSRData5` | REST | Campaign leaderboard rows: lead calls, booked jobs by call, inbound booking rate, campaign leads, total jobs booked, cancellations, campaign cost, completed revenue, ROI. |
| `getCSR5` | SQL fallback | Same campaign summary semantics from `st_campaign`. |

## HTML And CSS Widgets

| Asset | Used On | Purpose |
| --- | --- | --- |
| `html1.html` + `html1.css` | Company-wide Dashboard | Custom trending chart with 2024 vs 2025 sales/revenue bars, goal line overlay, tooltip behavior, fixed scale grid, and transformer-generated month HTML. |
| `html3.html` | Company-wide Dashboard | YTD revenue goal tracker that computes total goal sum, YTD revenue, percent to goal, and pacing. |
| `html4.html` | Company-wide Dashboard | Gross margin goal tracker with fixed 700k scale, 500k stripe marker, MTD fill, and remaining-to-goal display. |
| `html5.html` | Company-wide Dashboard | Sales summary split into Today vs Yesterday panels using `getSalesDB` and `getSalesDB2`. |
| `html6.html` | Service Technician Dashboard | Ranked technician card grid. Top card spans multiple rows and shows revenue plus per-tech KPIs. |
| `html7.html` | Installer Dashboard | Ranked installer card grid. |
| `html8.html` | Comfort Advisors Board | Ranked advisor card grid. |
| `html11.html` | Call Center Performance by CSR | Ranked CSR card grid with call booking rate, cancelled-before-dispatch, and cancellation % fields. |
| `html12.html` | Lead Generation | Ranked lead generation card grid. |
| `html13.html` | Campaign Summary Report | Ranked campaign card grid with ROI handling. |
| `html14.html` | Call Center Performance Summary | Aggregate CSR summary card with lead calls, inbound booked, manual booked, total jobs booked, booking rate, cancelled-before-dispatch, and cancellation %. |
| `$appStyles.css` | App-wide | Global typography overrides, large menu-button sizing, bold default text scale. |

## Secrets And Placeholders To Externalize

- ServiceTitan OAuth client ID:
  - `cid.3uu1y44n3ouhdhhdq2arla286`
- ServiceTitan OAuth client secret:
  - `cs5.r0a0u4hnmxj1v4xzqfi87vunrejtq9o4rqkhqt1lc0zca7khww`
- ServiceTitan app key:
  - `ak1.w4l5o1oh0suj888aeb4mkirux`
- ServiceTitan tenant ID:
  - `686965608`
- ServiceTitan report category / report ID mappings:
  - technician `66109112`
  - technician-dashboard `112224016`
  - operations `80249474`, `6771127`, `116192131`, `111413515`
  - business-unit-dashboard `219`, `228`
  - marketing `898`, `930`
  - other `115808515`
- Business unit ID sets currently hardcoded in request payloads:
  - `[1809, 64313020]`
  - `[1812, 64326403, 64567559]`
  - `[1809, 1810, 1812, 64313020, 64315277, 64326403, 64567559, 64569092, 64569731]`
- Retool Storage folder names that should become typed asset configuration:
  - `technicians_photo`
  - `logos`

## Risky Or Ambiguous Logic

- Workflow wait blocks are arbitrary:
  - `1` second before technician fetch
  - `70` second delays between several report families
  - no explicit polling or status check exists in Retool
- Workflow metadata timezone is `Asia/Shanghai`, but the actual business logic everywhere uses `America/Los_Angeles`. The migration must preserve LA business-date semantics.
- The company-wide page mixes live REST queries and DB snapshot fallbacks in the same screen. The new system must preserve the same output semantics and precedence rules.
- Several page queries point at Retool resources with no explicit URL in the page RSX. The workflow export reveals the underlying ServiceTitan endpoints, but page-only inspection is insufficient.
- `getPerformanceCSR` and `getPerformanceSummary` both point to report `116192131`. The difference appears to be how the data is displayed and/or date slicing rather than a distinct report source.
- `getCSR2` reads from `st_per_csr` while page 6 is labeled Summary. `getCSR3` reads from `st_per_summary` while page 7 is labeled By CSR. Live Retool DB inspection confirms both tables share the same stored schema; the naming is still inverted or stale.
- `st_csr` is written in workflow but is not read by any exported page query.
- The workflow step `populateGoalTracker` writes to `st_revenue`, not `st_goal_tracker`. The naming is misleading and must be normalized carefully.
- Some comments disagree with numeric constants in transformers. Example: monthly pace code comments mention a 2nd-of-month start or a minimum of 3 days, while the actual numeric guards do not fully match the comment.
- Several HTML widgets contain computational assumptions, not just markup. Sorting, formatting, rank highlighting, and label selection happen inside those widgets and must be moved into typed functions or typed view models.
- Technician/advisor/installer/CSR/campaign headshots and logos are sourced from Retool Storage folders and matched by normalized file names. The asset mapping behavior must be reproduced.
- Live Retool Postgres inspection confirms the active snapshot tables are populated and current, including `st_capacity`, `st_job_costing_summary`, `st_revenue`, `st_per_csr`, `st_per_summary`, `st_sales`, `st_sales_yes`, `st_sales_monthly_pace`, `st_revenue_monthly_pace`, `st_booking_rate`, `st_marketing`, and `st_trending`.

## Migration Assumptions

- Preserve raw snapshot behavior exactly:
  - latest page reads are equivalent to `ORDER BY snapshot_time DESC LIMIT 1`
  - raw ServiceTitan payloads remain stored for audit/debugging
- Move all hardcoded IDs and credentials to typed configuration, but keep the discovered IDs as default seeded config values until validated otherwise.
- Keep current page naming, report naming, and metric labels unless the export makes a clearer naming source available.
- Treat the exported workflows as the source of truth for report endpoints when the page export omits the URL.
- Treat Retool Storage folders as source-of-truth asset buckets for the initial migration.
- Introduce normalized read models only in addition to raw snapshot storage, not instead of it.
- Preserve current ranking/sorting/display semantics over “cleaner” reformulations when comments and code diverge.

## Parity Requirements

- Service Technician Dashboard:
  - preserve ranking by `totalInfluencedRevenue`
  - preserve weighted totals for close rate, average sale from opportunities, membership conversion
  - preserve optional enrichment fields such as callback rate, commission, headshots
- Installer Dashboard:
  - preserve ranking by installed revenue
  - preserve weighted billable efficiency and weighted average install
- Company-wide Dashboard:
  - preserve marketing donut grouping and top-N bucket behavior
  - preserve booking rate math
  - preserve capacity rollups
  - preserve monthly pace formulas and LA date boundaries
  - preserve gross margin goal tracker outputs
  - preserve sales today vs yesterday summary
  - preserve trending overlay output and goal line semantics
  - preserve manual monthly goal entry/update behavior
- Comfort Advisors Board:
  - preserve ranking by total sales and related opportunity fields
- Call Center Summary and By CSR:
  - preserve lead/inbound/manual/total booked metrics and booking rate display
  - preserve summary vs leaderboard output even though table naming is inconsistent
- Lead Generation:
  - preserve `leadsGenerated = leadOpp + replacementOpportunity`
  - preserve `goodLeads = leadsSet + replacementLeadsSet`
  - preserve `bookingRate = goodLeads / leadsGenerated`
- Campaign Summary:
  - preserve ranking by lead calls
  - preserve ROI semantics including negative ROI and fallback ROI derivation when cost and revenue exist
