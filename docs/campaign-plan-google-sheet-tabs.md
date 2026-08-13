# Campaigns: production input tabs

The existing `Master Sheet` remains the source for call-center actuals. Add the following three tabs to the same monthly workbook when an approved plan or a mid-month revision is available. The dashboard reads these tabs but does not overwrite them.

## Campaign Plan

Columns `A:O`:

`Month | Channel | Category | Qualified Lead Goal | Booked Opportunity Goal | Approved Budget | Sold Amount Goal | Revenue Goal | Budget Type | Approved By | Approved At | Status | Effective From | Revision Reason | Notes`

Rules:

- `Month` uses `YYYY-MM`.
- `Category`: `paid`, `organic`, `retention`, `partner`, or `other`.
- `Budget Type`: `platform`, `manual`, `prepaid`, or `none`.
- `Status` must be `Draft` until Tim/Emil approve the plan, then `Approved`.
- Approved rows are the locked original monthly plan. Never edit approved values after the month starts.

## Capacity Plan

Columns `A:G`:

`Month | Team | Headcount | Opportunities Per Day | Working Days | Effective From | Notes`

The monthly opportunity requirement is:

`sum(Headcount * Opportunities Per Day * Working Days)`

The current model uses 25 planning days and Tim's 3 opportunities/day for service teams and 4 opportunities/day for Comfort Advisors. Operational pace is calculated using elapsed weekdays in the actual calendar month, while the approved monthly requirement remains fixed.

## Campaign Forecast

Columns `A:J`:

`Month | Channel | Qualified Lead Forecast | Booked Opportunity Forecast | Budget Forecast | Sold Amount Forecast | Revenue Forecast | Effective From | Reason | Updated By`

Use this tab for mid-month budget, roster, or channel changes. Forecast rows change the effective pace target but do not overwrite the original approved plan.

## Refresh behavior

- `Refresh data` reads the latest `Master Sheet`, all three optional planning tabs, and ServiceTitan reports `898`, `7148368`, and `101394656`.
- Lead and opportunity pace uses weekdays.
- Spend pace uses calendar days.
- A missing plan is shown as `DRAFT MODEL - APPROVAL REQUIRED`; model values are never labeled approved.
- The dashboard generates a next-month recommendation, but it remains a recommendation until copied into `Campaign Plan` and approved.
