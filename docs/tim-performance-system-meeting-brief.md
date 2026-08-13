# Tim Meeting Brief: Technician Performance System

Prepared: 2026-07-20

## Meeting Goal

Approve the pilot data contract and owners so one technician report can be reconstructed from real data for one historical week.

This is a decision meeting, not an implementation demo.

## Materials

- `EXAMPLE-Weekly-Coaching-Report.pdf`: accepted six-block visual reference.
- `july-2026-performance-goals-draft.csv`: PDF page 6 normalized and merged with membership goals.
- `tech-conversion-report-audit.md`: findings from the received workbook.
- `performance-dashboard-plan.md`: full implementation plan and source requirements.

## What Is Already Agreed

- The TV dashboard redesign is complete and separate from this system.
- One employee-facing US Letter page per technician.
- Six fixed blocks: Pace, Three Dials, Job Execution, Field Pro, Last Focus, One Focus.
- ServiceTitan outcomes and behaviors plus Field Pro conversation evidence.
- Exactly one primary coaching focus with a measurable target.
- Manager review and approval before delivery.
- Dispatcher Audit to manager/HR routing is a later workstream.

## Important Findings To Show Tim

### The received Excel is not the sales plan

`Tech Conversion Report .xlsx` contains membership performance and membership count goals. It does not contain the revenue and sales targets required by the coaching report.

Its `Summary` formulas are also incorrect: the Summary monthly membership goal is `165`, while the master technician rows total `145`.

### The PDF goal seed needs approval

The PDF page 6 goals total exactly `$2,000,000`, but they are still mock/reference data until Tim approves them.

The normalized draft contains 18 roster rows: 15 with PDF sales goals and 3 marked as missing sales goals. It reconciles to `$2,000,000` in sales goals, `41` turnover quota, and `145` membership goals.

One row is materially inconsistent:

- Azat Akynov stated goal: `$90,000`.
- Formula inputs: `38 opportunities * 48% * $3,050`.
- Formula result: `$55,632`.
- Difference: `$34,368`.

The goal or at least one of its three drivers must be corrected.

### Cross-source roster conflicts

- `Ivan Avila` versus `Ivan Avila Oliveira`.
- Almaz: HVAC Service in the PDF, HVAC Maintenance in the membership workbook.
- Winston: HVAC Service in the PDF, Recalls/Warranty in the membership workbook.
- Kenneth: Commercial HVAC versus Commercial Service/Sales.
- Bahruz Brian Rasulov, Ethan Peters, and Le'Jhavani De La Cruz-Robello appear in the membership workbook but have no rows in the PDF sales-goal seed.

These require canonical ServiceTitan technician IDs and effective department dates.

### Reference-format inconsistencies

- The PDF says generated Saturday and presented Monday; the meetings describe a Monday run and Thursday-Friday coaching.
- Almaz's June 30-July 6 example cites a July 7 evidence job.
- Mapping and goals appendices clip text at the right edge.
- The mapping mentions technician photos, but the example technician pages do not render them.

## Decisions Required From Tim

1. Approve or correct every row in `july-2026-performance-goals-draft.csv`.
2. Confirm whether PDF page 6 is the official July plan or only illustrative data.
3. Select one pilot department and one completed Monday-Sunday historical week.
4. Confirm canonical ServiceTitan technician IDs, departments, and managers for the pilot roster.
5. Decide whether Bahruz, Ethan, and Le'Jhavani are in scope and provide their missing sales targets if they are.
6. Confirm whether on-time arrival and average time on site belong on the one-page PDF or only in the manager view.
7. Confirm Monday generation with Thursday-Friday coaching, or provide the intended alternative.
8. Decide whether technician photos appear in the PDF. Recommended v1 default: no photo, preserving space for evidence and coaching.
9. Confirm who approves each report and who receives the approved PDF.
10. Confirm whether Notion and Slack are later conveniences or required v1 destinations. Recommended v1 default: PDF and manager review only.

## Source Owners Tim Must Identify

| Data | Required confirmation |
| --- | --- |
| Revenue, opportunities, close/conversion, average sale | ServiceTitan report IDs and role-specific definitions |
| Options per opportunity | Qualifying job types and estimate-option counting rule |
| Home Health Report Card | ServiceTitan form ID and eligible completed-job denominator |
| Membership offered | Estimate item/rubric source and eligible-job definition |
| Memberships converted | Confirm whether the received workbook remains the source or can be replaced by a ServiceTitan report |
| Review request | Review event/report owner and job-level evidence |
| Turnovers | ServiceTitan CRM source and service-role quotas |
| 48-hour estimate follow-up | ServiceTitan activity versus matched Dialpad call log |
| Financing presented | Estimate option or custom field; omit from v1 if not captured reliably |
| Field Pro | Admin/access owner for recordings, scorecards, speaker metrics, summaries, and links |

## Recommended Pilot

Choose the department with the best Field Pro recording coverage and at least one week with enough scored recordings to support the weakest-two rubric calculation.

HVAC Service is the preferred business candidate because the reference report is most complete for that workflow, but it should not be selected until its recording coverage is verified.

## Proposed 20-Minute Agenda

1. `0-3 min`: Confirm the six-block report and pilot objective.
2. `3-8 min`: Review and correct the July goal draft, especially Azat and roster conflicts.
3. `8-13 min`: Assign a source and owner to every required metric.
4. `13-16 min`: Select pilot department, roster, and historical week.
5. `16-18 min`: Confirm generation, review, meeting, and delivery cadence.
6. `18-20 min`: Record owners, access actions, and deadlines.

## Required Meeting Outcome

Do not leave the meeting with only general approval. Record:

- Approved pilot department and technician roster.
- Approved goal rows and target definitions.
- One historical test week.
- ServiceTitan and Field Pro access owner.
- Source owner for every metric.
- Manager reviewer and recipients.
- Generation and coaching schedule.
- Explicit decisions for every unresolved row or a named owner and due date.
