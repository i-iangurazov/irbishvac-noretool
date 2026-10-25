# Revenue & Sales

Implements [Emil's Revenue & Sales Tab task](https://app.notion.com/p/400c710dca6e80af9c07daea5fb7a186) inside the existing Marketing workspace. Uses its shared shell, Montserrat type, green/orange palette, cards, controls and chart library.

| Requirement | Result |
| --- | --- |
| Revenue & Sales navigation | Renamed the existing tab; preserves the `view=revenue` URL |
| Revenue / Sales | Summary toggle updates the total, acquisition cards, distribution, table and efficiency labels |
| Circular distribution | Channel / business-unit selector, currency and percentage legend, full breakdown disclosure |
| Paid Channels / Organic / Unmapped | Existing category mapping retained, including automation under Organic; all channel dollars remain in totals |
| Performance Marketing / Branding/ATL | Media spend split by existing paid and separate-spend categories; other spend reconciled explicitly and commissions separate |
| ROAS / SOAS / Expense ratio | Efficiency selector; channel sorting by amount, return descending or expense ratio ascending |
| Performance by Channels | Table plus horizontal bar chart, independent all/paid/organic filters and independent chart Revenue/Sales selection |
| Responsive interface | Two-column desktop layout; readable mobile cards and channel rows; scrollable table and expandable chart on small screens |

## Metric definitions

- Revenue uses `actual.completedRevenue`; Sales uses `actual.soldAmount`, the sold-estimate amount, not collected cash. Existing attribution, dates, cutoff, plans, costs and source joins remain intact.
- ROAS = covered paid-channel completed revenue / covered paid media spend. SOAS = the same covered channels' sold-estimate value / paid media spend. This follows the [advertising return definition](https://business.google.com/ca-en/accelerate/resources/articles/glossary/) and is separate from ROI or the existing all-in return metrics elsewhere in the dashboard.
- A paid channel with financial/lead/job activity but no positive recorded spend is excluded from both sides of ROAS/SOAS. The interface marks partial coverage and names missing channels in Metric definitions & data coverage. Spend-only paid channels remain in the denominator. Zero income gives 0×; zero cost gives unavailable, never infinity.
- **Marketing Efficiency expense ratio** = all recorded marketing media spend, including Branding/ATL and other tracked spend, / total selected Revenue or Sales. Missing recorded costs may understate it; the partial-coverage indicator and explanation remain visible.
- **Channel expense ratio** = that paid channel's media spend / its selected Revenue or Sales. Undefined denominators and nonpaid advertising returns display — and sort last. Commissions do not silently enter media spend.
- Positive chart values determine circular areas. Negative adjustments stay separately visible; the UI explains that positive values determine chart shares. Source departments are never proportionally scaled to campaign revenue. An explicit reporting reconciliation retains the authoritative total.

## Business-unit data

Revenue reuses the existing department report. Sales now aggregates the existing sold-estimates report's explicit `BusinessUnit` column (also accepts compatible parent-job/name aliases); blanks remain Unassigned. This adds `salesByDepartment` to the snapshot and the read API. Existing snapshots without this additive field remain compatible and show an explicit unavailable state. Newly generated snapshots include the field through the existing worker path; no report configuration or production snapshot was changed manually.

Read-only verification used the October snapshot generated on 2026-10-25 with cutoff 2026-10-25 (24 channels and 12 department records). The existing sold-estimates report for exactly the same period contained 228 estimates and six business units. Its sales total reconciled to the snapshot's $1,524,088.11. Raw evidence and credentials remain local and are not committed.

## Validation

- Web: 199 tests passed; domain: 98 tests passed. Includes switches, independent filters, business-unit data and missing-data behavior, zero/unknown costs, spend-only channels, company versus channel expense scopes, reconciliation, sorting and server hydration.
- Full Next.js build, web/domain typechecks and ESLint on changed files passed. The clean build uses local placeholder runtime configuration, not production credentials.
- Browser checks use the real `/marketing?month=2026-10&view=revenue` route, shared shell, fonts, logo and styles. Local-only authentication/data adapters supply read-only source snapshots; production authentication is unchanged. All controls and Revenue/Sales department states were exercised at 390, 768, 1440 and 1920 px, with zero page overflow and no JavaScript errors. Desktop/mobile screenshots visually inspected.
- `apps/web/scripts/qa-revenue-sales.mjs` provides repeatable browser checks against a local app, with `REVENUE_QA_BASE_URL`, `REVENUE_QA_MONTH`, `REVENUE_QA_OUTPUT_DIR` and optional `REVENUE_QA_REQUIRE_UNITS=1`. Full-page captures temporarily expand the native scrolling container only during capture; normal app scrolling stays unchanged.
- Web suite was run with two workers and a 15-second test timeout to avoid CPU-contention timeouts in the existing 24-hour TV-recovery simulation. No product timeout changed.

No production database/report writes, refresh requests or direct production deployment were performed.
