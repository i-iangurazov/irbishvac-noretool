# Membership Performance

Authenticated route: `/call-center/memberships`. Accessible from the Call Center menu and the CSR view tabs. Uses the existing dashboard authentication and header. The Campaigns integration key does not grant access to this route.

## Sources and definitions

- **Active members:** `ActiveAtEnd` in Membership Monthly Report (`other/80173089`), with inactive membership types included. This counts memberships, not distinct customers. It is the balance at the selected period end, rather than today's REST status (which can include future-start memberships).
- **New sales / renewals:** `sold-by/899` (Memberships Sold By Report), selected by `SoldOn`, separated using `ActivationMethod = New Sale / Renewal`. Deleted membership records are excluded by this report. The headline, department totals and representative table use the same records. These counts can differ from the legacy Membership Summary NewSales/Renewed columns, which use invoice/status-history semantics and include subsequently deleted records. Never silently mix the two definitions or add renewals to a new-sales target.
- **Cancellations:** `Canceled` in `other/80173089`, reflecting memberships whose final status change in the period was cancellation. **Cancellation rate:** this count divided by `ActiveAtStart`; a zero denominator returns unavailable, not 0%.
- **Renewal rate:** fixed-term membership records with term end in the selected range, excluding deleted memberships and those cancelled on or before term end. A renewal succeeds when the record links through `renewedById` to a non-deleted membership with `SoldOn <= period end`. Early renewals count for their expiration cohort; renewals sold after the period do not. Ongoing memberships with no term end are not renewal opportunities. REST `/memberships/v2/tenant/{tenant}/memberships` supplies relationships and term dates; `operations/972` supplies authoritative SoldOn dates. Incomplete links produce an unavailable rate. The cohort numerator is distinct from renewals sold within the period. These are live corrected records, not a frozen historical ledger.
- **Sales attribution:** SoldBy matched by normalized full name against active and inactive ServiceTitan employees/technicians. The existing CSR roster includes its managers. Technicians use their current business unit for HVAC/Plumbing attribution. Historical former employees retain their sales; unmapped names remain under Other / unassigned. No attribution is guessed from a customer's department.
- **Recurring services:** `operations/80117992`, `FilterBy=0` (Recurring Service Event Date). Deduplicate by event ID. Scheduled, In Progress, Hold, Completed and Won count as booked; cancelled jobs, Not Attempted, Unreachable and Contacted count as outstanding. Dismissed events are separate, so `booked + outstanding + dismissed = total`. Completed is a subset of booked. This view reflects current booking status for the selected due-date cohort, not booking status reconstructed at a past cutoff. September 2026 currently has no events due; this was verified against the direct REST event listing. It is not missing data.

Official references: [Membership Summary](https://help.servicetitan.com/v1/docs/membership-summary-report), [Customer Memberships](https://help.servicetitan.com/v1/docs/customer-memberships-report-template), [Recurring service events](https://help.servicetitan.com/v1/docs/view-recurring-service-events).

## Goals

The user confirmed 10 **new** memberships per month for each CSR and HVAC/Plumbing **service** technician. Active zero-sale representatives remain in the target roster. HVAC Maintenance is included. Install, sales/advisor, inactive and other employees can have attributed sales but no goal. Team goal progress only includes representatives with an assigned target; overall sales also include sellers outside that goal group.

The selected-period target is 10 per calendar month touched by the range (MTD = 10; January–September = 90). Partial months retain the full monthly target. Targets use the current active roster; they do not attempt to reconstruct historical hiring dates. `MEMBERSHIP_MONTHLY_GOAL` and `MEMBERSHIP_GOAL_SCOPE` configure this without changing sales attribution.

## Delivery

The worker refreshes MTD every 15 minutes and YTD hourly in America/Los_Angeles. Opening missing/stale periods also queues their exact date range. Refresh explicitly queues source ingestion, and the UI polls job completion. Completed jobs have a 60-second cooldown to limit repeated requests. This is periodically refreshed reporting with on-demand refresh, not a streaming event feed.

Only aggregate snapshots and employee sales totals are persisted, under `CALL_CENTER_SOURCE` / `membership-performance:v1:{from}:{to}`. Customer contacts, addresses, invoice details, credentials and raw membership records are not returned to the web or saved in this read model. API/worker clients are read-only toward ServiceTitan. REST and report pagination must be complete. Source failures remain unavailable; full refresh failure retains the last snapshot and original timestamp. No cross-period fallback is allowed.

All four report IDs are configurable through `ST_REPORT_MEMBERSHIP_*`. Existing Google Sheets, CSR calculations, shared header styles and Campaigns key permissions remain unchanged.
