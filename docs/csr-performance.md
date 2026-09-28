# CSR performance

Routes: `/call-center/summary` and `/call-center/by-csr`.

Both views share one roster and the same exact Los Angeles business date range. The API will not substitute a YTD snapshot for MTD or a different custom period. Desktop/TV pages show four CSR cards; narrow screens use two or one columns. TV pages rotate every 15 seconds. Normal browser pages stay on the selected page.

## Metric definitions

- **Lead calls:** ServiceTitan CSR Booking Performance (`ST_REPORT_CALL_CENTER_PERFORMANCE`), `LeadCalls`.
- **Text leads:** the consolidated `Master Sheet` only, with `Call/Text` = Text or Form and `Opportunity` = Good or Mid. Attribution uses the receiving `CSR`, not `Booked By`. Source tabs duplicate Master Sheet records and are never added again. Date filtering is inclusive of the selected business dates. The observed `Nina Naem` spelling is explicitly mapped to `Nina Naeem`; other names require normalized full-name matches.
- **Leads received:** lead calls plus qualified text leads. Unassigned or unmatched text leads are excluded from CSR totals and disclosed separately.
- **Booking rate:** inbound calls booked divided by lead calls. Team rate is calculated from total numerator and denominator, including employees with zero conversions. It is not an average of employee percentages, and does not mix text/manual bookings into phone conversion.
- **Booked jobs:** unique job numbers from Job Detail By CSR (report 177, configurable with `ST_REPORT_CSR_JOBS`), filtered by Job Creation Date (`DateType=2`) and attributed to `BookedBy`. Includes all booking channels. This replaces the old inbound-plus-manual count, which omitted some created jobs.
- **Cancelled jobs / cancellation rate:** the above created jobs whose current status is Canceled; cancellations divided by those unique booked jobs. Includes cancellations before and after dispatch.
- **Memberships sold:** Membership Sales Detail (report 921, `ST_REPORT_CSR_MEMBERSHIPS`), filtered by Sold On, attributed to `SoldBy`. These are membership sales, not membership renewals or the current membership balance.
- **Missed calls:** Calls Taken in the report's Abandoned row. ServiceTitan does not attribute that row to an individual employee, so cards show unavailable rather than zero. No invented per-employee attribution.

The roster includes CSR/customer-service roles, Membership Manager, Adele as CSR manager, and other office report employees with verified text-lead assignments. It excludes the synthetic Abandoned row and unrelated office staff. The underlying report excludes inactive employees; the summary is the displayed CSR team, not all company employees.

## Automatic delivery

The worker refreshes MTD every 30 minutes and YTD hourly. Supplementary reports are shared between both pages and cached for ten minutes per exact date range. Only aggregate supplementary data is persisted. Complete report pagination is required; rate-limited pages are retried with bounded delays. A failed source produces unavailable values rather than a fabricated zero.

`GOOGLE_CSR_REPORTS_FOLDER_ID` points to the shared CSR Reports folder. The existing Google service account needs Viewer access and Google Drive API enabled. Discovery reads spreadsheets directly in this folder and in its year/quarter subfolders. Monthly titles supply the reporting month; quarterly summaries and drafts are excluded. Explicit `GOOGLE_CALL_CENTER_SPREADSHEET_IDS_BY_MONTH` mappings take precedence. Duplicate monthly candidates are not guessed. Existing configured sheet IDs remain a fallback if Drive is unavailable.

Metadata is read before bounded Master Sheet ranges. January 2026 contains values appended to several header labels; its known label prefixes are supported without ingesting the header as a lead. Full requested-month coverage is required for text totals; a partial YTD set is never displayed as full-year data.

Existing asset URLs supply employee photos, with initials when an image is missing. The shared header, logo, global navigation, Marketing dashboard and Campaigns integration key permissions are unchanged.
