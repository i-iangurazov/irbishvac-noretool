# Technician Performance Dashboard Plan

Last updated: 2026-07-09

## Objective

Build a weekly performance system that combines ServiceTitan sales metrics with Field Pro behavior metrics, then turns them into simple coaching views and PDF reports for each technician.

This plan is intentionally not an implementation. The current implementation pass only updates the existing field dashboard card layout.

## Outcomes

- Give each technician a weekly report that explains what happened and which behaviors to improve.
- Give managers a dashboard that highlights coaching priorities instead of requiring manual analysis.
- Make sales performance coachable by connecting outcomes, such as close rate and average sale, to behaviors, such as options offered and client talk time.
- Route dispatcher audit results into HR and management workflows with objective history.

## Data Sources

### ServiceTitan

Initial metrics:

- Close rate
- Options per opportunity
- Average sale
- Total sales
- Completed revenue
- Memberships sold
- Replacement lead conversion
- Opportunities and closed opportunities

### Field Pro

Initial metrics:

- On-time arrival
- Total client time
- Client talk time percentage
- Tech talk time percentage
- DNR or unclassified time percentage
- Appointment duration

### Dispatcher Audit

Initial metrics:

- Dispatcher audit score
- Missed process steps
- Repeated coaching issues
- Escalation flags
- Review history by employee and manager

## Product Surfaces

### 1. TV Field Dashboard

Purpose: fast visibility on the floor or office TV.

MVP:

- Show top 4 to 5 technicians per board.
- Use large photo-first cards.
- Fit in one screen with no vertical scroll.
- Keep only the most readable metrics on the card.
- Preserve MTD/YTD filters and TV/kiosk rotation.

Later:

- Add a "coaching priority" badge.
- Add department-specific cards for HVAC service, plumbing service, electrical service, installers, and advisors.
- Add drilldown from a TV card to the technician profile.

### 2. Manager Performance Dashboard

Purpose: identify who needs coaching and why.

MVP:

- Rank technicians by performance gap, not only revenue.
- Show a scorecard with outcome metrics and behavior metrics side by side.
- Highlight the top 1 to 3 coaching levers per person.
- Compare the technician to department median and top performer benchmark.

Views:

- Department overview
- Technician detail
- Weekly coaching queue
- Metric trend by technician
- Dispatcher audit history

### 3. Weekly Technician PDF

Purpose: simple report each technician can read and discuss with a manager.

MVP sections:

- Summary: week, department, technician, manager
- Outcome metrics: sales, close rate, average sale, memberships
- Behavior metrics: options per opportunity, client talk time, time with client, on-time arrival
- Benchmark comparison: technician vs. department median vs. top performer
- Coaching focus: 1 or 2 concrete goals for next week
- Notes: manager comments and follow-up date

Example coaching rule:

- If options per opportunity is below department target and close rate is below median, recommend increasing options per opportunity before focusing on closing scripts.

### 4. HR And Dispatcher Audit Workflow

Purpose: make audit history usable for reviews, warnings, and manager follow-up.

MVP:

- Store dispatcher audit events by employee, date, audit category, score, and manager.
- Add a management view that filters by employee, category, severity, and date.
- Add exportable evidence summaries for HR.
- Track acknowledgement, coaching action, and resolution state.

## Data Model Additions

Recommended new read models:

- `technician_weekly_performance`
- `technician_behavior_metrics`
- `technician_coaching_insights`
- `technician_weekly_reports`
- `dispatcher_audit_events`
- `dispatcher_audit_actions`

Recommended normalized keys:

- Technician ID from ServiceTitan when available
- Employee email or stable HR identifier when available
- Name as display text only, not the primary join key
- Department and business unit snapshot per reporting period

## Pipeline

### Phase 1: Ingestion

- Confirm ServiceTitan report IDs for options per opportunity and opportunity-level sales metrics.
- Confirm Field Pro export/API access and stable employee identifiers.
- Confirm Dispatcher Audit source format.
- Store raw snapshots before transforming data.
- Add validation around required columns and date ranges.

### Phase 2: Normalization

- Resolve technician identity across ServiceTitan, Field Pro, and Dispatcher Audit.
- Normalize all metrics into weekly buckets.
- Store department membership as of the report week.
- Keep raw values and calculated values separate.

### Phase 3: Insights

- Calculate weekly scorecards.
- Compare each technician to department median, target, and top performer.
- Generate coaching flags from simple rules first.
- Add trend analysis only after the raw weekly model is reliable.

### Phase 4: Reporting

- Generate HTML report templates first.
- Render PDFs from the same HTML to avoid duplicate report layout logic.
- Store generated PDFs with report metadata.
- Send reports by email only after manager review is approved.

### Phase 5: Dashboard

- Add manager overview pages.
- Add technician detail pages.
- Add Dispatcher Audit management views.
- Add role-based access before HR-sensitive audit data is exposed broadly.

## MVP Cut

First useful release:

- Weekly ServiceTitan + Field Pro scorecard for one department.
- Technician identity mapping table.
- Manager dashboard with 4 to 5 key metrics.
- PDF preview generated on demand.
- No automatic email sending yet.

Second release:

- Automatic weekly PDF generation.
- Manager approval/send workflow.
- Dispatcher Audit storage and management view.

Third release:

- HR routing, disciplinary summary exports, trend-based coaching, and broader department coverage.

## Open Questions

- What is the canonical employee identifier across ServiceTitan, Field Pro, HR, and Dispatcher Audit?
- Does Field Pro provide an API, scheduled export, webhook, or only manual files?
- Who approves weekly technician PDFs before they are sent?
- Should reports go directly to technicians, managers only, or both?
- What targets should be used per department for options per opportunity, close rate, and client talk time?
- Which audit categories are HR-sensitive and require restricted access?

## Risks

- Name-based joins will create bad reports when names differ across systems.
- Field Pro talk-time categories need clear definitions before they become coaching metrics.
- PDF automation should not start until manager preview and correction flows are in place.
- Dispatcher Audit data needs access control before it is exposed inside general dashboards.
