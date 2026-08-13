# Technician Performance System Plan

Last updated: 2026-07-21

## Status

The TV dashboard and technician-card redesign are complete. A first web MVP of the separate weekly performance and coaching system now exists at `/performance`: it merges the July draft plan with current ServiceTitan technician/advisor read models and the previous completed week's Field Pro reports, provides an 18-person manager queue, renders one six-block report route per technician, and prints each report to one US Letter page.

Field Pro Technician Recording Activity report `125959497` and Field Pro Job Recordings report `125959432` are connected through the ServiceTitan Reports API. The 2026-07-13 through 2026-07-19 pilot snapshot contains 17 recordings, 15 quality recordings, and 14 job-level recording rows with duration. The MVP is not the production-complete system: goals remain draft; Field Pro scorecards, speaker share, transcripts, and Atlas evidence are not exposed by these reports; several job-execution sources are unavailable; manager approval is not persisted; and email delivery is not connected.

The six-page `EXAMPLE-Weekly-Coaching-Report.pdf` reference was visually reviewed on 2026-07-20. Its technician-page layout, data mapping, generation rules, and seed-goal structure are incorporated below.

## Objective

Give every technician one useful weekly coaching report and give managers enough evidence to coach the technician without manually reviewing every job and recording.

The report must answer five questions:

1. Is the technician on pace for the monthly sales plan?
2. Which measurable behaviors explain the result?
3. What did the technician do well last week?
4. What is the single highest-value behavior to improve next week?
5. Which real job or recording proves the recommendation?

## Project Boundaries

### In scope now

- Monthly sales-plan intake for company, department, and technician targets.
- Weekly ServiceTitan performance metrics.
- Technician-owned ServiceTitan Audit results as job-level execution evidence.
- Field Pro recording coverage, scorecard data, and conversation coaching evidence.
- A manager review queue.
- A weekly technician PDF generated from an approved report.
- One-department pilot before company-wide rollout.

### Separate follow-up workstream

- Dispatcher/accounting-owned audit events and weekly summaries.
- Restricted manager and HR routing for policy or disciplinary workflows.
- Acknowledgement, coaching, warning, and resolution history.
- Restricted access to employee-relations evidence.

### Already complete

- TV-first technician cards.
- Fixed four-column technician and installer boards.
- Large technician photos with initials fallback.
- No-scroll TV layout while preserving the existing card statistics.
- Manager performance queue backed by current ServiceTitan read models.
- Draft goal-to-employee matching with explicit identity/source warnings.
- One six-block browser report route for each of the 18 plan rows.
- Print-to-PDF styling verified as one US Letter page for all 18 report routes.
- Automated weekly ingestion for Field Pro recording activity and job recordings.
- Field Pro coverage, quality rate, duration, and supporting job references in the API and technician report.

## Definition Of Done

The first production release is done when:

- A sales plan can be imported for one month and validated before publication.
- Every active pilot technician is mapped across ServiceTitan and Field Pro.
- A Monday run creates one report draft per technician for the previous Monday through Sunday.
- The draft includes the complete MVP scorecard, source timestamps, missing-data warnings, and supporting job or recording references.
- Every technician draft fits on one US Letter portrait page and follows the accepted six-block order.
- A manager can review, edit the coaching focus, approve, and regenerate the PDF.
- No report is delivered automatically before manager approval.
- The approved report remains immutable and can be reproduced from stored source snapshots.
- The weekly run exposes failures, incomplete technicians, and stale data instead of silently producing partial reports.

## Weekly Operating Cadence

All reporting dates use the IRBIS business timezone.

| Day | System or owner | Action |
| --- | --- | --- |
| Before the month starts | Tim or designated owner | Upload company, department, and technician sales targets. |
| Monday | System | Ingest the previous Monday-Sunday data, calculate scorecards, analyze Field Pro evidence, and create report drafts. |
| Tuesday-Wednesday | Tim and managers | Review evidence, correct data, and edit the coaching focus. |
| Thursday | Manager | Deliver approved reports during HVAC and plumbing service coaching meetings. |
| Friday | Manager | Deliver approved reports during sales/advisor coaching meetings. |
| After meeting | Manager | Record acknowledgement, notes, and the next follow-up date. |

The report contains two periods at the same time:

- Weekly behavior: previous Monday through Sunday.
- Monthly plan progress: month-to-date through the end of that Sunday.

The example PDF says `Generated Saturday 6:00 AM` and `Presented Monday`, while the meetings describe a Monday data run followed by Thursday-Friday coaching. The example does not identify whether that Saturday is before or after the report week. The implementation default remains Monday after the weekly window closes until the operating cadence is explicitly changed.

## Canonical Weekly Scorecard

The system must not hide a requested metric because its data source is not ready. Unavailable metrics remain visible as `Data unavailable` with a reason and source owner.

### Sales plan and outcomes

| Metric | Definition | Primary source | MVP status |
| --- | --- | --- | --- |
| Monthly sales goal | Approved target for the technician and month. | Sales-plan import | Required |
| Monthly opportunity target | Approved expected opportunity volume for the technician and month. | Sales-plan import | Required |
| Target close / conversion rate | Department-appropriate rate target: `close` for sales roles and `conversion` for service roles. | Sales-plan import | Required |
| Target average ticket / sale | Approved average-value target for the technician. | Sales-plan import | Required |
| MTD revenue | Completed or attributed revenue through report cutoff. | ServiceTitan | Required |
| Goal attainment | `MTD revenue / monthly goal`. | Calculated | Required |
| Expected by date | `monthly goal * elapsed calendar days / days in month`. | Calculated | Required |
| Pace percentage | `MTD revenue / expected by date`. | Calculated | Required |
| Pace gap | Expected revenue minus MTD revenue. | Calculated | Required |
| Weekly sales | Sales attributed during the report week. | ServiceTitan | Required |
| Opportunities | Qualifying sales opportunities during the report week. | ServiceTitan | Required |
| Closed opportunities | Opportunities sold during the report week. | ServiceTitan | Required |
| Close rate | `closed opportunities / opportunities`. | ServiceTitan | Required |
| Average ticket / average sale | Revenue divided by the agreed sold-job denominator. | ServiceTitan | Required; definition must be confirmed |
| Memberships sold | Memberships sold during the report week. | ServiceTitan | Required |
| Turnover or replacement leads | Leads created and converted compared with quota. | ServiceTitan | Required only for applicable departments |

The accepted reference uses calendar-day pacing. The cutoff timestamp and timezone must be stored with every report so regeneration produces the same expected-by-date value.

### Job execution and selling behaviors

| Metric | Definition | Primary source | MVP status |
| --- | --- | --- | --- |
| Options per opportunity | Average number of valid options presented per qualifying opportunity. | ServiceTitan estimates | Required |
| Home Health Report Card completion | Eligible completed jobs with the required submitted form or attachment. | ServiceTitan form | Required after form workflow is configured |
| Membership offer rate | Eligible opportunities containing at least one Home Care Plan option, regardless of sale. | ServiceTitan estimate items | Required |
| Review request rate | Eligible completed jobs where the review request workflow was completed. | Existing review report or completion form | Required after source owner confirms feed |
| Average time on site | Average `completion/departure - arrival` duration for eligible appointments. | ServiceTitan appointment events | Required |
| On-time arrival rate | Arrivals during the first half of the promised arrival window. | ServiceTitan appointment events | Required |
| Lead score completeness | Jobs that require a lead score and contain a valid score/source. | ServiceTitan job data | Manager quality flag; not a technician score until ownership is confirmed |
| Estimate follow-up within 48 hours | Open estimates with a verified follow-up contact event within 48 hours. | ServiceTitan activity or approved call-log source | Comfort Advisor variant; source must be confirmed |
| Financing presented | Ran opportunities where financing was presented through an agreed estimate option or custom field. | ServiceTitan estimate/custom field | Comfort Advisor variant; source must be confirmed |

Eligibility rules must be versioned by department and job type. Recalls, warranties, no-charge jobs, cancelled jobs, multi-tech jobs, and multi-appointment jobs cannot be handled by ad hoc exclusions.

The existing `marketing_os_agent` ServiceTitan Audit is a supporting source for this block. Use the scoped Sales, HVAC Service, Plumbing Service, and Technician Compliance rules rather than treating every legacy Dispatcher Audit alert as technician performance. Technician-owned and shared findings can provide job-level evidence for options, arrival, forms, photos, supporting evidence, and time-entry behaviors. Dispatcher- or accounting-owned findings remain manager-only and must not reduce a technician metric.

The agent currently persists failures only. Those records can be shown as verified issues, but they cannot produce a compliance percentage. Rates such as `3+ options compliance` or `on-time arrival rate` require an exported result for every eligible rule evaluation with `pass`, `fail`, `insufficient_data`, or `not_applicable`, plus the eligible-job denominator. Missing audit data must remain `Data unavailable`; zero stored violations must never be displayed as 100% compliance.

### Field Pro adoption and conversation quality

| Metric or evidence | Definition | Primary source | MVP status |
| --- | --- | --- | --- |
| Recording coverage | Completed eligible appointments with a usable Field Pro recording. | Field Pro Job Recordings report | Required |
| Total recordings | Completed recordings during the report week. | Field Pro reports | Required |
| Quality recording rate | Recordings meeting the configured duration and processing threshold. | Field Pro reports | Required |
| Average recording duration | Average minutes for usable recordings. | Field Pro reports | Required |
| Field Pro overall score | Weighted score for the configured scorecard. | Field Pro Scorecards | Required when a reliable extraction path is confirmed |
| Process score | Process adherence score. | Field Pro Scorecards | Required when available |
| Skills score | Selling and objection-handling score. | Field Pro Scorecards | Required when available |
| Communication score | Communication quality score. | Field Pro Scorecards | Required when available |
| Client talk share | Percentage of classified conversation time spoken by the client. | Field Pro recording metrics | Required when available |
| Technician talk share | Percentage spoken by the technician. | Field Pro recording metrics | Required when available |
| DNR / unclassified share | Percentage not assigned to either speaker. | Field Pro recording metrics | Required when available |
| Strength | Most material repeated positive behavior with evidence. | Field Pro coaching analysis | Required |
| Growth area | Most material repeated behavior to improve with evidence. | Field Pro coaching analysis | Required |
| Real coaching moment | One specific job/recording moment linked to the recommendation. | Field Pro transcript/bookmark | Required |

Recording coverage is a prerequisite metric. Low talk share or scorecard performance must not be presented as representative when only a small fraction of eligible appointments was recorded.

## Weekly Coaching Output

Each technician draft follows the six blocks from the example PDF:

1. Pace to Goal: monthly goal, MTD revenue, expected revenue by the cutoff, pace percentage, and dollar gap.
2. The Three Dials: ran opportunities, close/conversion rate, and average ticket/sale versus the technician's targets.
3. Job Execution: department-specific leading behaviors, results, targets, and supporting job references.
4. Conversation Quality: Field Pro recorded-call count, average process score, two weakest rubric steps, speaker pattern, and one evidence moment.
5. Last Week's Focus: prior target, result, and whether the technician closed at least half of the original gap.
6. This Week's One Focus: one direct instruction, the exact play to execute, a measurable target, and estimated monthly dollar impact.

The manager view retains source freshness, additional strengths and problems, department comparisons, evidence links, notes, approval state, and follow-up date. The employee PDF stays within the accepted one-page hierarchy.

The system can suggest coaching, but the manager owns the final recommendation. Generated findings must link to evidence and must never invent quotes, events, or reasons for a sale outcome.

## Example Coaching Logic

Rules are deterministic first. AI explains and summarizes the evidence after the calculations are complete.

1. If options per opportunity and close rate are both below target, focus on options presented before closing scripts.
2. If Home Health Report Card completion is low, focus on diagnostic completeness before sales outcomes.
3. If membership offer rate is low, focus on consistently including the plan in options rather than memberships sold.
4. If average time on site is below the department threshold and options are low, focus on discovery and diagnosis time.
5. If technician talk share is high and client talk share is low across enough recordings, focus on questions and listening.
6. If recording coverage is below threshold, the focus is recording adoption; conversation conclusions are marked low confidence.
7. If a metric improved after last week's focus, acknowledge it before assigning the next focus.

Only one primary focus is selected. Secondary observations remain visible but do not become competing weekly goals.

The reference report proposes a deterministic ranking: normalize each eligible leading metric and Field Pro rubric item against its department benchmark, select the largest negative gap, and let the language model write the explanation and play. The manager can override the selected focus. A prior focus is considered `moved` when at least 50% of its baseline-to-target gap closes; two consecutive weeks without movement create a manager escalation, not an automatic HR action.

Dollar impact is calculated from the selected metric with visible assumptions. For a close-rate focus, the reference formula is `(target rate - actual rate) * monthly opportunities * average ticket`. Other focus metrics need their own versioned formulas; generated narrative must not invent an impact number.

## Product Surfaces

### 1. Sales Plan Import

Initial input is Excel or CSV with one row per target.

Required columns:

- Month.
- Scope type: company, department, or technician.
- Department or business unit where applicable.
- ServiceTitan technician ID or approved employee ID where applicable.
- Sales goal.
- Monthly opportunity target.
- Target close/conversion rate.
- Target average ticket/sale.
- Turnover quota for applicable service roles.
- Ramp flag for new technicians whose volume targets need separate treatment.
- Optional targets for options per opportunity, memberships, and other department metrics.

Import behavior:

- Preview before commit.
- Reject invalid dates, duplicate keys, unknown employees, and negative values.
- Show the company total, department totals, and technician totals before approval.
- Do not silently force child targets to equal the parent target; show reconciliation differences.
- Version imports and retain who approved each version.
- Store `approved_by` and `approved_at` rather than treating an uploaded file as automatically approved.

The goal engine stores monthly targets. The weekly opportunity target shown in Block 2 is `target_opps / 4.43`. The example derives a presentable revenue goal from `target_opps * target_rate * target_avg`; production must retain the approved goal and its component assumptions so rounding never changes the approved amount silently.

Page 6 of the example provides July 2026 seed values for the initial import fixture, including a $2,000,000 company goal and service-role turnover quotas. These are test/reference inputs, not values to hardcode in the application.

### 2. Manager Review Dashboard

This is the primary internal application, separate from the TV leaderboard.

Required views:

- Weekly run status and missing-data summary.
- Department coaching queue.
- Technician report detail.
- Evidence drawer with source metric, job, recording, transcript/bookmark, and calculation details.
- Edit coaching focus and manager notes.
- Approve, reject, and regenerate PDF.
- Historical reports and metric trends.

### 3. Weekly Technician PDF

The PDF is a coaching handout, not a dense dashboard export. The accepted template is one US Letter portrait page per sales-facing technician with a dark, high-contrast layout and exactly six numbered blocks.

Production pack structure:

1. One six-block coaching page per in-scope technician.
2. Optional manager-only data-quality appendix when a run contains warnings.
3. No format-review cover, mock-data banner, data-mapping pages, or seed-goals page.

Header requirements:

- Department or business unit.
- `Weekly Coaching Report` and report-week range.
- Technician name as the strongest page identifier.
- Draft status when the page is not approved.

HTML is the single layout source for browser preview and PDF rendering. Every technician page and assembled pack must be visually checked at final PDF size.

### Example PDF Review

`/Users/ilias_iangurazov/Commercial/irbishvac-marketing/EXAMPLE-Weekly-Coaching-Report.pdf` was reviewed visually on all six pages on 2026-07-20.

What the production template should retain:

- One dense but readable page per technician for a three-to-four-minute coaching conversation.
- Clear numbered hierarchy for the six blocks.
- Department-specific Block 3: service roles show options, Home Health Report Card, membership offer, reviews, and turnovers; Comfort Advisors show options, 48-hour estimate follow-up, financing, and reviews.
- Pace status: green at or above 100%, amber from 85% through 99%, and red below 85%.
- Dial status: green at or above target, amber at or above 85% of target, and red below 85%.
- One evidence-backed Field Pro moment and exactly one direct next-week focus.
- Combined-pack ordering by department, then worst pace first within the department.
- Missing data renders as `No data this week` with the reason; it does not remove the employee page.
- Dollars rounded to whole dollars, rates to whole percentages, and options to one decimal.
- No publishing before Tim or the assigned manager approves the report.
- Store the input snapshot, calculation/rule version, prompt version, model output, and approved narrative for auditability.

Visual acceptance criteria:

- One technician page never spills onto a second PDF page.
- Pace and the one coaching focus are identifiable immediately.
- Dollars, percentages, ratios, job numbers, evidence, and coaching copy remain readable at 100% and in print.
- Status is communicated by value and text, not color alone.
- Evidence and coaching copy are capped to the available space; overflow fails visual QA instead of being clipped.
- Long names, missing metrics, zero recordings, long job numbers, and multi-line focus copy have dedicated fixtures.

Production corrections required:

- The example's long subtitle and table content clip at the right edge on the first data-mapping page and goals page. Production needs constrained columns, wrapping, and PDF overflow checks.
- The Almaz example is labeled for June 30-July 6 but cites a July 7 job. Production must reject evidence outside the report period instead of silently mixing weeks.
- `Tech name, BU, photo` appears in the example's mapping, but the two rendered coaching pages do not include a photo. Photo inclusion is a deliberate template decision, not an assumed requirement.
- The mock-data banner, data-specification pages, and seed-goals page are review material and should not be sent to technicians.
- The example mentions a per-technician Notion draft and a Slack DM to Tim. Those are optional delivery integrations pending confirmation; the core approval and PDF workflow must not depend on them.

### 4. Dispatcher Audit Manager And HR Workflow

Technician-owned audit evidence is part of the weekly report pipeline. This separate workflow covers dispatcher/accounting ownership, repeated policy signals, and restricted HR actions after the weekly technician-report vertical slice is reliable.

Required behavior:

- Ingest weekly audit events by employee, job, category, severity, and date.
- Route operational coaching items to the responsible manager.
- Route policy or repeated serious issues to authorized HR users.
- Preserve evidence, source links, acknowledgement, action, owner, due date, and resolution.
- Support repeated-event thresholds such as three late arrivals without automatically turning a signal into discipline.
- Keep HR-sensitive notes out of the general manager dashboard and technician PDF.

## Data Access Strategy

### ServiceTitan Audit agent contract

The dashboard must not read the agent's Render SQLite file directly. The agent exports a versioned, authenticated weekly JSON snapshot and the dashboard stores it with the same immutable snapshot pattern used for ServiceTitan reports.

Each evaluation includes:

- Reporting period, generated timestamp, and ServiceTitan timezone.
- Rule ID, ruleset, rule version, status, severity, and ownership (`technician`, `shared`, `dispatcher`, or `accounting`).
- ServiceTitan job, appointment, technician, and business-unit IDs plus display names.
- Title, factual explanation, recommended action, evidence metadata, and source link.
- Eligibility status so the dashboard can retain the numerator, denominator, and insufficient-data count.

The initial technician allowlist is the scoped options, arrival, diagnosis/form, photos, supporting-evidence, and technician time-entry rules. Payment, dispatch notes, diagnostic-fee, and other dispatcher/accounting findings stay out of the employee PDF unless Tim explicitly changes ownership.

### Existing ServiceTitan foundation

The repository already contains:

- ServiceTitan report ingestion.
- Raw immutable report snapshots.
- Dashboard read models.
- Background refresh jobs with retry and run history.
- Technician IDs and existing sales metrics including revenue, opportunities, close rate, average sale, leads, and memberships.
- A company-level monthly goal table.

The performance system should extend these patterns instead of building an unrelated ingestion stack. The existing goal table is not sufficient because it stores only one company amount per month; department and technician targets need a new model.

The example PDF names conceptual tables such as `goals`, `qa_scores`, `fieldpro_scores`, `fieldpro_rubric_items`, and `focus_history`. None of those models exists in the current Prisma schema. The normalized models below implement those concepts without assuming that the example table names are already available.

### Field Pro access

ServiceTitan exposes a Job Recordings dataset and standard reports for job recordings, technician recording activity, coverage, quality rate, duration, job, opportunity, and revenue context. The two IRBIS reports are now ingested directly through the Reports API for the previous completed Monday-Sunday week; XLSX files are retained only for manual reconciliation.

The connected reports do not provide every requested conversation field. Scorecard exports are currently unavailable, and transcript-level prompts, speaker share, Process/Skills/Communication details, and verified coaching moments still require an access spike.

Use this priority order:

1. ServiceTitan report API for custom Job Recordings reports. **Implemented for reports 125959497 and 125959432.**
2. ServiceTitan scheduled report delivery to a controlled mailbox or storage location.
3. An official Field Pro export or API enabled by the ServiceTitan account team.
4. Authorized browser automation only if no supported interface exists and the workflow is stable enough to operate safely.

The Field Pro spike must prove whether the system can retrieve:

- Recording ID and job ID.
- Technician ID or email.
- Recording and transcript URLs.
- Speaker-share metrics.
- Scorecard category scores.
- AI summary and coaching spotlight.
- Transcript text or timestamped bookmarks.
- Ask Field Pro / Atlas answers for a standard prompt set.

Do not begin broad AI analysis until access, recording coverage, and stable identifiers are proven for a representative week.

## Field Pro Agent Contract

The requested Field Pro agent is a weekly evidence processor, not a general chatbot.

For each eligible usable recording, it must produce structured output:

- Recording and job identifiers.
- Technician identifier.
- Processing status and confidence.
- Behaviors completed well.
- Behaviors missed or weak.
- Objection-handling evidence.
- Discovery/listening evidence.
- Options, financing, and membership discussion evidence where available.
- Off-topic or loss-of-control evidence only when supported by a timestamped moment.
- One or more source timestamps/bookmarks.
- A short factual summary.

For each technician and week, it aggregates:

- Repeated strengths.
- Repeated growth areas.
- Two weakest scorecard dimensions.
- One high-value real coaching moment.
- Recording coverage and confidence.

The reference report adds these v1 aggregation rules:

- Average the process score over usable recorded jobs.
- Average rubric-item scores by item and select the bottom two.
- Exclude a rubric item from the weakest-two ranking when fewer than three jobs were scored for it.
- Flag extreme dead air or technician talk share, but always cite the supporting job and retain the configurable threshold.
- In v1, an evidence moment can be selected from the source Field Pro summary for the lowest-scored opportunity job; raw transcript ingestion is not required if the source summary and job link are auditable.
- Low recording coverage is itself a page warning and lowers the confidence of all conversation conclusions.

The structured schema is versioned. Prompt changes must not overwrite prior results, and every generated statement must retain its source recording references.

## Proposed Data Model

Recommended additions:

- `employee_identity`: canonical employee plus ServiceTitan ID, Field Pro identity, email, department, and effective dates.
- `performance_plan`: monthly target by scope with goal amount, target opportunities, target rate, target average, turnover quota, ramp flag, import version, and approver.
- `performance_week`: reporting boundaries, cutoff, status, and run metadata.
- `technician_weekly_metric`: metric key, value, numerator, denominator, target, source, and confidence.
- `fieldpro_recording`: recording/job identity, technician, duration, quality, source link, and processing status.
- `fieldpro_recording_analysis`: schema version, prompt version, findings, evidence, and confidence.
- `technician_coaching_draft`: strengths, issues, selected focus, target, impact assumptions, and evidence references.
- `technician_weekly_report`: draft/approved/delivered version and rendered PDF metadata.
- `manager_review`: reviewer, edits, approval, notes, and timestamps.
- `service_titan_audit_evaluation`: employee, job, rule/ruleset version, ownership, result status, severity, evidence, source date, and eligible denominator state.
- `dispatcher_audit_action`: owner, routing destination, acknowledgement, action, due date, and resolution.

Names are display values only. Cross-system joins use a stable ID or an explicitly approved identity mapping.

## Pipeline

```text
Sales-plan file -----> validate/import -----+
                                             |
ServiceTitan reports -> raw snapshots -------+--> weekly metrics --> coaching rules ---+
                                             |                                      |
Field Pro reports ----> recordings/coverage -+--> evidence agent -------------------+--> manager review --> HTML/PDF --> delivery
                                             |                                      |
ServiceTitan Audit ---> rule evaluations ----+--> technician evidence ---------------+
                                                    |
                                                    +--> dispatcher/accounting events --> restricted manager/HR workflow
```

Pipeline requirements:

- Idempotent weekly runs.
- Raw source preservation.
- Metric-level lineage and freshness.
- Explicit partial-failure state.
- Retry without duplicate drafts or reports.
- Recalculation after corrected inputs.
- Immutable approved report versions.
- Audit logging for target, coaching, and approval changes.

## Delivery Phases

### Phase 0: Data contract and access spike

Status: Field Pro report IDs, date parameters, API schemas, and the 2026-07-13 through 2026-07-19 pilot extraction are proven. The complete sales-plan workbook and advanced Field Pro evidence path remain open.

Deliverables:

- Final metric dictionary and denominator rules.
- Pilot department and technician roster.
- Sample sales-plan Excel file.
- ServiceTitan report IDs and required custom forms.
- Field Pro Job Recordings test report.
- Proven Field Pro extraction matrix for coverage, scorecards, talk metrics, transcript, and evidence links.
- Reviewed `EXAMPLE-Weekly-Coaching-Report.pdf` reference.

Exit criterion: one technician and one week can be reconstructed manually from source data with every value traceable.

### Phase 1: ServiceTitan weekly vertical slice

Status: Browser MVP, ServiceTitan MTD outcomes, draft goals, and identity warnings are implemented. Approved goals and manager-verified weekly denominator rules remain open.

Deliverables:

- Identity mapping.
- Sales-plan import and validation.
- Weekly and MTD ServiceTitan metrics.
- Goal attainment and pace calculations.
- Missing-data dashboard.
- Automated tests using one known historical week.

Exit criterion: the system reproduces manager-verified ServiceTitan values for every pilot technician.

### Phase 2: Field Pro agent vertical slice

Status: Recording inventory, coverage, quality rate, duration, and job references are implemented. Scorecard, talk-share, transcript, and generated coaching evidence remain open.

Deliverables:

- Recording inventory and coverage.
- Structured per-recording analysis for the standard prompt set.
- Technician-level strength, growth area, weakest dimensions, and evidence moment.
- Confidence and source links.

Exit criterion: Tim or the assigned reviewer validates a sample of generated findings against the original recordings.

### Phase 3: Manager review and PDF

Deliverables:

- Report draft generation.
- Manager review and editing.
- HTML preview and PDF rendering.
- Approved report history.
- Visual QA against the example report at final page size.

Exit criterion: a complete report is approved and used in one real coaching meeting.

### Phase 4: Weekly automation and rollout

Deliverables:

- Monday scheduled run.
- Run monitoring and failure notification.
- Controlled delivery after approval.
- Department templates and targets.
- Rollout to the next department only after two reliable pilot weeks.

### Phase 5: Restricted Dispatcher Audit routing

Deliverables:

- Reuse the audit evaluations already ingested for performance evidence.
- Manager and HR routing rules.
- Restricted evidence view.
- Acknowledgement and resolution history.
- Weekly audit summary with repeated-issue detection.

## Immediate Work Order

1. Obtain the complete monthly sales-plan Excel example and turn it into a validated import contract.
2. Confirm the pilot department; the completed historical week 2026-07-13 through 2026-07-19 is already loaded.
3. Lock the metric dictionary and exclusion rules with Tim.
4. Confirm an official extraction path for Field Pro scorecards, speaker metrics, transcript/summary, and Atlas evidence.
5. Complete the remaining ServiceTitan job-execution feeds and manager-verified weekly calculations.
6. Add a versioned weekly ServiceTitan Audit export containing all eligible rule evaluations, not failures only, and ingest it as an immutable snapshot.
7. Implement the Field Pro evidence-agent layer on top of the connected recording inventory.
8. Persist manager review, approval, and approved report history.
9. Connect controlled PDF email delivery after approval.
10. Run one shadow week before any technician receives the report.

## Required Inputs And Owners

| Input | Owner | Why it is required |
| --- | --- | --- |
| Example sales-plan Excel | Tim | Defines company, department, technician, and target structure. |
| Example weekly coaching PDF | Tim / Ilias | Supplied and visually reviewed; defines the expected six-block hierarchy. |
| Pilot department and roster | Tim | Limits the first release and provides the identity map. |
| Metric targets by department | Tim and department managers | Needed for coaching rules and comparisons. |
| ServiceTitan report/form configuration | Ilias plus ServiceTitan admin | Needed for options, forms, memberships, time on site, and Field Pro reports. |
| Review-request source | Review program owner | Needed to calculate review request rate reliably. |
| Field Pro access and permissions | ServiceTitan admin/account team | Needed for recordings, scorecards, insights, and evidence. |
| Report reviewer and recipients | Tim | Needed for approval and delivery permissions. |
| ServiceTitan Audit ownership and rule allowlist | Tim, managers, HR | Separates technician coaching evidence from dispatcher/accounting and restricted HR events. |

## Open Decisions With Recommended Defaults

| Decision | Recommended default |
| --- | --- |
| Pilot department | Start with the group that has the best Field Pro recording coverage, not the largest group. |
| Weekly cutoff | Previous Monday-Sunday, frozen during the Monday run. |
| Pace calendar | Calendar-day formula from the accepted PDF: `goal * elapsed days / days in month`. |
| PDF recipients | Manager first; technician only after approval. |
| Coaching goals | One primary focus with one measurable target per week. |
| Benchmark | Department target plus median; show top performer as context, not as the only standard. |
| AI confidence | Suppress behavioral conclusions when evidence coverage is below the agreed threshold. |
| Missing data | Show unavailable with reason; never treat missing as zero. |
| Report correction | Regenerate a new version and retain the original draft. |
| HR escalation | Human decision only; the system routes evidence and never issues discipline automatically. |
| 48-hour follow-up source | Confirm whether ServiceTitan activity or the matched Dialpad call log is authoritative before showing the Comfort Advisor row. |
| Financing-presented source | Confirm an estimate option or custom field; omit the row from v1 if it is not captured reliably. |
| Technician photo in PDF | Decide explicitly; the reference mapping mentions a photo, but its example technician pages do not render one. |
| Notion and Slack | Optional after the manager-review PDF works; they cannot be required for report generation. |

## Risks And Controls

- Field Pro coverage may be too low. Control: report recording coverage and block low-confidence conclusions.
- Field Pro scorecards are not retroactive. Control: record configuration date and never compare unsupported periods.
- Scorecard export is not currently available. Control: complete the access spike before committing to a collection method.
- Name-based joins create incorrect employee reports. Control: explicit cross-system identity mapping.
- Different departments need different eligibility and target rules. Control: versioned metric definitions by department and job type.
- AI summaries may overstate evidence. Control: source links, timestamped moments, confidence, and manager approval.
- Sensitive employee information can leak. Control: role-based access and a separate restricted HR surface.
- A visually dense PDF can fail in the actual meeting. Control: reference-based design and screenshot/PDF inspection at final page size.

## External Product References

- [Field Pro overview](https://help.servicetitan.com/v1/docs/field-pro-overview)
- [Field Pro Job Recordings report](https://help.servicetitan.com/docs/field-pro-job-recordings-report)
- [Field Pro Technician Recording Activity report](https://help.servicetitan.com/v1/docs/field-pro-technician-recording-activity-report)
- [Field Pro Recordings Per Technician report](https://help.servicetitan.com/v1/docs/field-pro-recordings-per-technician-report)
- [Field Pro scorecards](https://help.servicetitan.com/docs/review-scorecards-in-field-pro)
