# Tech Conversion Report Workbook Audit

Reviewed: 2026-07-23

Source: `/Users/ilias_iangurazov/Downloads/Tech Conversion Report  (1).xlsx`

Workbook report date: 2026-07-20

## Conclusion

This workbook is a month-to-date membership-conversion report. It is not the requested company/department/technician sales-plan workbook.

It can supply membership goals and current membership performance, but it cannot supply monthly revenue goals, target opportunity volume, target close/conversion rates, target average sale, or turnover quotas.

## Workbook Structure

The workbook contains 21 sheets:

- `Summary`: department and company membership rollup.
- 18 individual technician membership scorecards.
- `Technicians`: master input/calculation table.
- `Weekly Log`: manually copied company totals by week.

Only `Technicians` should be considered for structured ingestion. The individual technician sheets are presentation views, and `Summary` contains incorrect formulas.

## Usable Fields

The `Technicians` sheet contains:

- Business unit.
- Technician display name.
- MTD job opportunities.
- MTD memberships converted.
- Actual membership conversion rate.
- Monthly membership count goal.
- Percentage of membership goal achieved.

These values should be joined to a canonical employee record by ServiceTitan technician ID. The workbook does not contain that ID, so initial name matches require explicit review.

## Data Quality Findings

### Incorrect Summary goals

The `Summary` sheet reports a company membership goal of `165`, while the master `Technicians` sheet totals `145`.

The first department goal is correct, but subsequent Summary formulas use shifted ranges. Examples:

- HVAC Maintenance uses `SUM(Technicians!F7:F12)` instead of its department rows.
- HVAC Sales uses `SUM(Technicians!F8:F13)` instead of its department rows.
- The same shifted-range pattern continues through the remaining departments.

All department and company summaries must be recalculated from normalized rows rather than imported from `Summary`.

### Cross-source identity and department differences

- The PDF uses `Ivan Avila`; the membership workbook uses `Ivan Avila Oliveira`.
- The PDF places Almaz Shamsharbek in HVAC Service; the workbook places him in HVAC Maintenance.
- The PDF places Winston Reyes in HVAC Service; the workbook places him in Recalls/Warranty.
- The PDF uses Commercial HVAC; the workbook uses Commercial Service/Sales for Kenneth Cox.
- The LeJhavani sheet title and technician display name differ in apostrophe formatting, and the individual scorecard has blank actual values.

These are identity-mapping decisions, not string-cleanup details. Tim or the ServiceTitan administrator must confirm the canonical technician ID and effective department.

### Current values in the July 20 workbook

- Bahruz Brian Rasulov has 6 membership opportunities, 0 conversions, and a membership goal of 5.
- Ethan Peters has 11 membership opportunities, 1 conversion, and a membership goal of 5.
- Le'Jhavani De La Cruz-Robello has 1 membership opportunity, 0 conversions, and a membership goal of 5.
- Brian Mota is still present under Plumbing Service with 25 membership opportunities, 1 conversion, and a membership goal of 10. He is absent from the newer July 23 direct ServiceTitan Performance Board export, so his active/reportable status needs manager confirmation.
- Winston Reyes is present under Recalls/Warranty, not HVAC Service or Plumbing Service.

These are membership goals only. They do not resolve the missing sales goals for Bahruz Brian Rasulov, Ethan Peters, or Le'Jhavani De La Cruz-Robello.

Missing values must remain missing with a source reason; they must not be converted to zero automatically.

## Import Recommendation

For the performance system:

1. Import normalized rows from `Technicians` only.
2. Treat the workbook's `Monthly Goal` as `membership_monthly_goal`, not `sales_goal`.
3. Recalculate all rates, department totals, company totals, and rankings.
4. Capture workbook report date and file checksum for lineage.
5. Resolve names to ServiceTitan technician IDs before generating employee reports.
6. Confirm who creates this workbook and whether a direct ServiceTitan report can replace the manual file.
