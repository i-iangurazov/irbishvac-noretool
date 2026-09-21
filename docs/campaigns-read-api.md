# Campaigns read API v1

Base URL: `https://irbisweb-production.up.railway.app/api/v1/campaigns`

Use the integration key in `Authorization: Bearer <key>` over HTTPS. Keep it on your backend, not in browser/mobile application code or a query string. Keys authorize Campaigns reads only, independently of dashboard login. They cannot access other dashboards, modify plans, or trigger data refreshes.

## Requests

```bash
curl --fail-with-body \
  'https://irbisweb-production.up.railway.app/api/v1/campaigns/performance?month=2026-09' \
  -H "Authorization: Bearer $IRBIS_CAMPAIGNS_API_KEY"
```

| GET path | Response |
| --- | --- |
| `/performance?month=YYYY-MM` | One month. Omitting `month` selects the current month in the reporting timezone. |
| `/periods` | Available dashboard months, cutoff dates, update timestamps, and snapshot status. |
| `/history?from=YYYY-MM&to=YYYY-MM` | Inclusive monthly reports and paid/organic chart series; maximum 12 months per request. |

All endpoints return JSON with `meta.apiVersion`, `meta.timezone`, `meta.currency`, and `data`. Performance `data` is an object; periods/history `data` is an array. Explicit older months can be requested even if they are outside the dashboard's recent-month list. Future months, invalid months, unknown/repeated parameters, and reversed/oversized ranges are rejected.

## Data

- `period`: reporting dates and elapsed days. `generatedAt`: when the underlying snapshot was generated. Responses read the existing dashboard snapshots; requesting data does not refresh ServiceTitan or Google Sheets.
- `overview`: completed revenue, sold estimates, sales value, qualified leads, booked jobs, total/paid/organic booking rates, spend, budget, coverage-adjusted ROAS/CPL/cost per booked appointment, and top-three paid/organic channels for each sort (`completedRevenue`, `soldAmount`, `roas`). Uses the same calculation helpers as the dashboard.
- `actual`, `rows`: company totals and channel records, including leads, jobs, spend, commissions, sales, revenue, targets, forecasts, attainment, and status. `actual.soldJobs` corresponds to Sold Estimates; `actual.soldAmount` is Sales Value. `actual.bookedJobs` is Booked Jobs.
- `revenueByDepartment`: department revenue. Its attribution can differ from campaign attribution; the dashboard's reconciliation entry is retained when supplied by the source.
- `plan`, `capacity`, `forecast`, `nextMonthDraft`, `pace`, `alerts`, `dataNotes`: the existing Plan & Capacity and reporting information.
- `spendCoverage`: partial/missing cost coverage, tracked-channel metrics, and missing channels. Do not interpret missing costs as genuinely free marketing.
- `sources`: source names, roles, availability, refresh times, and row counts. Internal report identifiers and authentication credentials are omitted.
- History additionally returns `series` for `qualifiedLeads`, `bookedJobs`, `completedRevenue`, and `soldAmount`, and `unavailableMonths` for months without snapshots.

Currency values are numeric USD amounts, not cents or display abbreviations. Rates and shares are fractions (`0.718` means 71.8%); ROAS is a multiplier (`7.6` means 7.6×). Undefined ratios are `null`. Optional fields may be omitted. Check `leadDataStatus`: `unavailable` means lead/booking metrics are missing, not zero; the ready-to-display `overview` and chart series use `null` for these missing metrics.

Category keys remain `paid`, `organic`, `automation`, `separate-spend`, and other existing category identifiers. Display `separate-spend` as **Brand / ATL Marketing**, with **Billboards, TV, Radio** as supporting text. Paid/organic chart series follow the dashboard's grouping; they need not sum to all-channel totals.

`dataStatus: LIVE` identifies the live-backed reporting source, not a real-time query. Always check `generatedAt` and `period.to`. Historical fallback snapshots are marked `SNAPSHOT`, and their sources are marked `stale`; the API and dashboard share fallback selection. Missing explicitly requested months return 404 rather than another month's data.

## Errors and usage

- 400: invalid query; 401: missing, incorrect, revoked, or expired key; 404: missing month or endpoint; 405: unsupported method; 429: rate limit (respect `Retry-After`); 503: upstream data temporarily unavailable.
- Limit: 60 authenticated requests per minute per web-service instance. The current limiter resets on process restart; add shared storage before scaling if a strict global quota is needed. Poll every 5–15 minutes; cache in your backend and retry 429/503 with backoff.
- GET/HEAD are read-only. Framework OPTIONS responses contain method information only. No write handlers are exposed. Responses use `Cache-Control: private, no-store` to avoid shared-cache disclosure.
- Request logs record integration ID, operation, status, and duration; they do not record keys or response data.

## Operator configuration

The web service accepts one dedicated Arman integration key. Set `CAMPAIGNS_READ_API_KEY_SHA256` to the SHA-256 hex digest of a randomly generated 256-bit key, and `CAMPAIGNS_READ_API_KEY_EXPIRES_AT` to its ISO timestamp. Only the hash is stored in deployment configuration. Missing/invalid configuration disables access.

To revoke, remove the hash and deploy/restart the web service. To rotate, replace the hash with that of a new random key and deploy/restart; the previous key then stops working. Deliver the plaintext key separately from this document. The existing internal dashboard credential must never be given to an integration client.
