# Implementation Notes

## Root Causes

- Monthly pace was inconsistent end to end:
  - sales pace was derived locally from `TotalSales`
  - revenue pace was summed from upstream `CurrentMonthlyPace`
  - the relevant MTD report requests were anchored to day 2 instead of day 1
  - `apps/web/components/company-wide-page.tsx` also had separate hardcoded pacing math using `356 / daysElapsed`
- Gross margin mapping could be wrong because `buildJobCostingSummary` fell back to `CompletedRevenue` when no direct gross-margin field was found, which can overstate MTD gross margin versus ServiceTitan.
- Gross-margin goal presentation also hid business meaning:
  - `remainingToGoal` was clamped to zero
  - the company-wide UI used clamped progress math and a misleading marker position
- Numeric formatting was mostly centralized already, but the company-wide monthly pace cards were still using compact formatting where stakeholders wanted full readable currency.
- Rotation was generic across dashboards:
  - unsupported boards could carry `rotate=1`
  - unsupported pages exposed rotation controls
  - the runtime rotated across all nav items instead of only service / sales / install boards
- Advisors already rendered `Closed Average Sale`, but totals were weighted by `SalesOpportunity` instead of closed opportunities, and the row value trusted the upstream column directly instead of deriving from closed-opportunity counts when available.

## Files Changed

- `packages/domain/src/metrics/company.ts`
- `packages/domain/src/metrics/advisors.ts`
- `packages/domain/src/metrics/company.test.ts`
- `packages/domain/src/metrics/leaderboards.test.ts`
- `packages/integrations/src/servicetitan/reports.ts`
- `packages/integrations/src/servicetitan/reports.test.ts`
- `packages/utils/src/format.test.ts`
- `apps/worker/src/read-models.ts`
- `apps/worker/src/rebuild-read-models.ts`
- `apps/api/src/modules/dashboard/dashboard.service.ts`
- `apps/web/lib/dashboard-filters.ts`
- `apps/web/lib/dashboard-filters.test.ts`
- `apps/web/components/company-wide-page.tsx`
- `apps/web/components/leaderboard-page.tsx`
- `apps/web/app/company-wide/page.tsx`
- `apps/web/app/technicians/page.tsx`
- `apps/web/app/installers/page.tsx`
- `apps/web/app/advisors/page.tsx`
- `apps/web/app/leads/page.tsx`
- `apps/web/app/campaigns/page.tsx`
- `apps/web/app/call-center/by-csr/page.tsx`
- `apps/web/app/call-center/summary/page.tsx`
- `packages/ui/src/components/dashboard-shell.tsx`
- `packages/ui/src/components/tv-settings-modal.tsx`

## Assumptions

- Sales monthly pace definition is local pacing from MTD `TotalSales`, using day 1 through the selected business date.
- Revenue monthly pace definition is the upstream ServiceTitan `CurrentMonthlyPace`, also using an MTD range that starts on day 1.
- Service / Sales / Install boards map to:
  - `/technicians`
  - `/advisors`
  - `/installers`
- Advisor `ClosedOpportunities` is the best available aggregate for the requested “one job = one closed opportunity” denominator. When that field is missing, the code infers the denominator from `TotalSales / ClosedAverageSale`.

## Unresolved Questions

- Stakeholder confirmation is still needed that the ServiceTitan screenshot uses the same gross-margin semantics as either:
  - direct gross-profit fields from the report, or
  - `Total - TotalCosts - LaborPay` when those fields are absent
- Advisor closed-average-sale correctness still depends on the upstream advisor report actually treating multi-estimate jobs and multi-technician sold-by credit the way the business described. The code now prefers explicit closed-opportunity counts when present, but that report-level assumption still needs validation against real data.
- This pass was layered on top of pre-existing uncommitted responsive-TV UI work in shared dashboard files. Those unrelated responsive edits were not reverted as part of this stakeholder-fix pass.
