# Membership Performance

Authenticated board: `/memberships`, listed independently under Call Center. The former `/call-center/memberships` URL redirects with its query intact. CSR Summary and By CSR retain their own two tabs. The Campaigns integration key grants no membership access.

## Periods and lifecycle

- **Active members:** `ActiveAtEnd` in Membership Monthly Report (`other/80173089`), including inactive plan types. This is the membership balance at the selected end date, not a distinct-customer count. Single-date mode sends the same start and end date. Current REST Active status can include future-start memberships and must not replace this balance.
- **New sales / renewals:** Memberships Sold By (`sold-by/899`), filtered by SoldOn and separated by ActivationMethod. Deleted records are excluded. Headline, department and representative totals use the same cohort. `other/123859331` adds plan/record information only when its sale signatures reconcile exactly to 899. Lifecycle summary NewSales/Renewed use different invoice/status-history definitions and must not be mixed with these counts.
- **Expired / cancellations:** separate Expired and Canceled columns in the monthly summary. These reflect final status changes during the period. Cancellation rate is Canceled / ActiveAtStart; zero denominator is unavailable.
- **Renewal rate:** nondeleted fixed-term memberships expiring in the selected range, excluding cancellation on/before expiry. A successful renewal links via renewedById to a nondeleted membership sold by period end. Early renewals count in the expiration cohort; ongoing memberships without expiry do not. Missing links yield unavailable. Membership term dates are date-only even when encoded at UTC midnight. These are live corrected source records, not a frozen historical ledger.
- **New sales rate:** New Sale memberships sold in the period as a share of memberships active at period start (ending balance is only a fallback when no starting balance is reported). It expresses growth intensity against the member base and is **not** a conversion percentage against opportunities; ServiceTitan does not expose the "eligible, non-member interaction" denominator the plan uses.
- **Period comparison:** the board compares renewal rate, cancellation rate, new sales rate and the underlying counts across the previous calendar month, the previous calendar quarter and the same span one year earlier. Each comparison period is fetched independently and shown as unavailable (never zero) when its source fails.
- **Activity:** read-only membership status-change export, filtered to the reporting dates in America/Los_Angeles and joined by membership ID. All changes are shown, so event counts can differ from the summary's final-status counts. Source notes are preserved. Removed records may be corrections; deletion alone does not prove an estimate withdrawal. The available data cannot reliably reconstruct removed estimate items or supply a cancellation reason that was never recorded.
- **Residential / commercial:** the customer's explicit CRM Type, joined from membership ID to customer ID. Plan names are not used to guess classification. CRM lookups are limited to 50 IDs and returned identities are validated. Missing classification is unavailable, not a zero.

## Revenue

**Membership sales value** sums MembershipPrice for the same new-sale and renewal cohort. It includes free/discounted sales and is explicitly not labelled cash collected or recognized revenue. New and renewal values are shown separately, with cent-accurate API amounts.

**Member job revenue** uses `other/80172722`, DateType=1 (Job Completion Date), with adjustment invoices included. Each invoice is retrieved by its exact number and validated; items with a positive membershipTypeId are deducted from reported TotalRevenue. This excludes subscription sale/renewal charges already present in a repair/installation invoice and retains invoice-level discounts. Deduplicate by invoice number; keep negative adjustments. Missing or ambiguous invoice evidence makes the metric unavailable. The source report defines the member cohort, so this is not an independently reconstructed historical membership-at-job-date ledger.

## Departments and goals

CSR, HVAC Service, HVAC Maintenance and Plumbing Service are separate. Attribution uses SoldBy and current employee/technician business unit, including inactive identities for historical sales. Installation, advisors and unmapped sellers remain visible in Other / unassigned.

The IRBIS Membership Conversion Goals plan (July–December 2026) was received from Natasha on September 30 and is now the source for the conversion-goal panel. It contributes: the 1,000-member company target by 2026-12-31 with the required net gain per month; the per-channel monthly ranges (CSR 30–40, HVAC Service 40–48, HVAC Maintenance 20–24, Plumbing Service 50–60, install/sales/commercial 45–60, total 200–252); the field tiers (minimum 6–8, target 10–12, stretch 14–18 per tech/month); the renewal milestones (40% by Aug 31, 60% by Q4); and the cold-outreach plan. Department ranges are planning goals, not observed performance.

The board preserves the approved **10 new sales/month** per current active CSR and HVAC/Plumbing service representative, including HVAC Maintenance. Renewals remain separate from target attainment. Partial months retain full monthly targets; historical periods use the current roster. Leaderboards can rank total, new sales or renewals. Filtering a department also recalculates its goal, attainment and remaining count.

`MEMBERSHIP_RENEWAL_TARGET` and `MEMBERSHIP_CANCELLATION_LIMIT` are optional decimal rates. When `MEMBERSHIP_RENEWAL_TARGET` is unset the board uses the applicable milestone from the approved plan (40% before Aug 31, 2026; 60% from September 2026 onward) so the renewal card shows a real target and breach state. `MEMBERSHIP_CANCELLATION_LIMIT` stays unset because the plan does not define one. Configured thresholds display target/limit and a visible breach state. No notifications are sent to others.

## Recurring maintenance and notes

`operations/80117992` selects event due dates (`FilterBy=0`). `operations/933` joins customer name, plan and service memo by event ID. Report dates, Spring (March–June) and Fall (September–November) are separate cohorts in the selected end year. All service types due in each window remain visible and can be filtered. Seasons do not imply that service type has been inferred from its name.

Statuses are mutually exclusive: scheduled, completed, hold, in progress, not attempted, contacted, unreachable, cancelled, dismissed, won. Booked includes scheduled/completed/hold/in-progress/won. Outstanding includes not-attempted/contacted/unreachable/cancelled. `booked + outstanding + dismissed = total`. These are **current** statuses for each due-date cohort, not historical status reconstruction. A September range can have zero events due while the full fall cohort has October events.

Clicking a status opens the customer list. Notes use an accessible modal and are stored locally in the dashboard, separate from ServiceTitan's recurring-service memo. Notes do not change ServiceTitan statuses. Authenticated IRBIS accounts and the existing administrator-approved shared dashboard account can append notes; the proxy supplies verified identity, checks same origin and requires a non-simple request header. Bodies are 1–2000 characters; UUID request IDs make retries idempotent. Events must exist in the requested dashboard snapshot. No client-supplied author is trusted.

Notes persist as immutable `CALL_CENTER_SOURCE` read-model records under `membership-service-note:v1:{eventId}:{requestId}`, independently of ingestion. They retain author ID and email (or explicit Shared dashboard label) and creation time. Each thread reads its latest 100 notes. Source refreshes never overwrite notes; no schema migration is needed.

## Delivery and access

Worker: MTD every 15 minutes, YTD hourly, plus exact-period on-demand refresh. Web polls refresh completion; this is periodically refreshed reporting, not a streaming feed. Invoice lookups use bounded concurrency. Reports and REST/export pagination must be complete. Missing sources remain unavailable and a total source failure retains the previous snapshot. No cross-period substitution.

Snapshots use `CALL_CENTER_SOURCE` / `membership-performance:v3:{from}:{to}`. The namespace was bumped to v2 for the redesigned board and to v3 for the period-comparison and conversion-goal additions, so an older payload shape never reaches the current UI. Aggregates, employee totals, customer names/IDs, selected service memos and lifecycle notes are available only behind existing dashboard authorization. Customer contact details, addresses, raw invoice lines, payment details and credentials are not exposed. All ServiceTitan calls are read-only.

The shared shell/body background is `rgb(246 247 250)`. Header geometry, logo and navigation controls are preserved. The existing CSR four-card layout is unchanged.

Primary references: [Membership Summary](https://help.servicetitan.com/v1/docs/membership-summary-report), [Customer Memberships](https://help.servicetitan.com/v1/docs/customer-memberships-report-template), [Recurring service events](https://help.servicetitan.com/v1/docs/view-recurring-service-events), and the tenant's live report definitions/dynamic date-filter values.
