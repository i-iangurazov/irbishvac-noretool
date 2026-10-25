# Revenue & Sales tab

Requirements: https://app.notion.com/p/400c710dca6e80af9c07daea5fb7a186

Reviewed against main `9b805ef0de9251d477ef216f3ced12e87561289d` on 2026-10-26. The other published branch pointed to the same commit; no later Revenue/Sales PR was returned by the repository search. Notion status is not treated as evidence of implementation.

| Requirement | Implementation |
| --- | --- |
| Revenue & Sales tab name | Header link renamed; existing view URL preserved |
| Total Revenue/Sales switch | Summary, group cards, distribution and table use selected value |
| Circular channel / business unit distribution | Accessible SVG rings and value/share legends; grouping selector |
| Paid Channels / Organic / Unmapped | Existing classification reused, including automation under Organic and retention/partner under Unmapped; ATL also remains visible |
| Marketing Spend split | Paid media = Performance Marketing; existing separate-spend category = Branding/ATL; commissions displayed separately |
| ROAS/SOAS and expense ratio ordering | Table sorts by selected value, return descending or expense ratio ascending, with undefined values last |
| Performance by Channels | Left table and right circular chart; independent all/paid/organic filters and chart Revenue/Sales switch |

## Definitions and limitations

- Revenue = `actual.completedRevenue`; Sales = `actual.soldAmount` (sold estimate value, not cash receipts). Both retain the existing period/cutoff.
- ROAS = attributed completed revenue / media advertising spend, consistent with the [Google Ads definition](https://business.google.com/ca-en/accelerate/resources/articles/glossary/). SOAS here means sold estimate value / media advertising spend and is explicitly defined in the UI; it is not ROI.
- Expense to Income/Sales Ratio = media spend / the corresponding attributed revenue/sales, displayed as a percentage. This tab uses the **same covered paid-channel cohort** on both sides for both return and expense ratios. These are paid acquisition metrics, not a claim about company-wide marketing efficiency.
- Commission costs are separate from the advertising denominator. Existing all-in calculations used elsewhere are unchanged.
- Active paid channels with no positive recorded spend are excluded from both sides and named in the partial-coverage notice. Zero spend is not assumed to mean free acquisition. Spend-only channels stay in the denominator. Zero income yields a zero return; division by zero is unavailable, never infinity. Nonpaid and ATL rows have no attributed paid return.
- All-channel totals retain Unmapped and ATL. A difference between channel and summary totals is an explicit reporting reconciliation item. Negative adjustments remain in the legend and are excluded from circle areas, with an on-screen explanation that shares use positive values.
- Business-unit revenue uses the existing invoice-item breakdown and its reconciliation. Sold estimate business-unit totals are added only when the source explicitly has `ParentJobBusinessUnit`, `BusinessUnit`, or `Business Unit`; blank values remain Unassigned. Existing reports without this dimension show unavailable Sales by business unit rather than reusing revenue or inventing allocations. No ServiceTitan report configuration is changed.

## Validation

- Web typecheck, domain typecheck and ESLint on changed TypeScript files passed.
- Next.js production compilation, lint and type validation passed. Full build stops at page-data collection because this clean checkout has no required runtime environment variables (database, Redis, authentication and ServiceTitan configuration). No production credentials were loaded.
- Web suite: 184 tests passed. Domain suite: 89 tests passed.
- Browser fixture used the real RevenueView component, August snapshot and marketing stylesheet. Chromium interactions checked summary Sales selection, paid table filtering and independent chart Sales selection at 390, 768, 1365 and 1920 pixels. Page overflow was 0 at every size, with no JavaScript errors. Mobile and laptop screenshots were visually inspected. Wide tables scroll inside their panel on small screens.
- The browser fixture bypassed the authenticated app shell; this is component responsive QA, not a production session test. No production API, database, refresh or deployment was invoked.
