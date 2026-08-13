import { DashboardShell } from "@irbis/ui";
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from "@irbis/utils";
import { getBrandLogoUrl, resolveStaffHeadshotUrl } from "../lib/assets";
import { navItems } from "../lib/api";
import type { PerformanceRosterRow, PerformanceStatus } from "../lib/performance-data";
import { PerformanceStaffAvatar } from "./performance-staff-avatar";

const STATUS_LABELS: Record<PerformanceStatus, string> = {
  "on-track": "On track",
  watch: "Watch",
  "off-track": "Off track",
  "missing-data": "Source missing",
  "missing-goal": "Goal missing"
};

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function valueOrDash(value: number | null, formatter: (input: number) => string) {
  return value == null ? "—" : formatter(value);
}

export function PerformanceDashboardPage(props: {
  roster: PerformanceRosterRow[];
  searchParams: Record<string, string | string[] | undefined>;
  cutoffDate: string;
}) {
  const departments = [...new Set(props.roster.map((row) => row.department))].sort();
  const requestedDepartment = takeFirst(props.searchParams.department);
  const activeDepartment = departments.includes(requestedDepartment ?? "")
    ? requestedDepartment ?? "all"
    : "all";
  const rows =
    activeDepartment === "all"
      ? props.roster
      : props.roster.filter((row) => row.department === activeDepartment);
  const trackedRows = props.roster.filter((row) => row.actual);
  const planTotal = props.roster.reduce(
    (total, row) => total + (row.monthlySalesGoal ?? 0),
    0,
  );
  const revenueTotal = trackedRows.reduce(
    (total, row) => total + (row.actual?.revenue ?? 0),
    0,
  );
  const onTrack = props.roster.filter((row) => row.status === "on-track").length;
  const sourceIssues = props.roster.filter(
    (row) => row.status === "missing-data" || row.status === "missing-goal",
  ).length;

  return (
    <DashboardShell
      activePath="/performance"
      brandLogoUrl={getBrandLogoUrl()}
      contentClassName="performance-dashboard__main"
      navItems={navItems}
      title="Performance Coaching"
      subtitle="Manager review queue for weekly technician coaching reports."
      headerContent={
        <div className="performance-dashboard__header-meta">
          <span>July 2026 plan</span>
          <strong>DRAFT</strong>
        </div>
      }
    >
      <div className="performance-dashboard" data-performance-dashboard="true">
        <section className="performance-dashboard__intro">
          <div>
            <div className="performance-eyebrow">Manager workspace</div>
            <h2>Weekly coaching queue</h2>
            <p>
              ServiceTitan outcomes and weekly Field Pro recording coverage are live where an
              employee match exists. Remaining process metrics stay visible as source gaps.
            </p>
          </div>
          <div className="performance-dashboard__cutoff">
            <span>MTD cutoff</span>
            <strong>{props.cutoffDate}</strong>
          </div>
        </section>

        <section className="performance-summary" aria-label="Performance summary">
          <div><span>Company plan</span><strong>{formatCompactCurrency(planTotal)}</strong><small>Draft target</small></div>
          <div><span>Matched MTD revenue</span><strong>{formatCompactCurrency(revenueTotal)}</strong><small>{trackedRows.length} of {props.roster.length} matched</small></div>
          <div><span>On pace</span><strong>{onTrack}</strong><small>At or above 100%</small></div>
          <div><span>Input issues</span><strong>{sourceIssues}</strong><small>Missing goal or identity</small></div>
        </section>

        <nav className="performance-tabs" aria-label="Filter by department">
          <a className={activeDepartment === "all" ? "is-active" : ""} href="/performance">All</a>
          {departments.map((department) => (
            <a
              className={activeDepartment === department ? "is-active" : ""}
              href={`/performance?${new URLSearchParams({ department }).toString()}`}
              key={department}
            >
              {department}
            </a>
          ))}
        </nav>

        <section className="performance-queue" aria-label="Technician report queue">
          <div className="performance-queue__heading">
            <div>
              <h3>{activeDepartment === "all" ? "All technicians" : activeDepartment}</h3>
              <p>Worst pace first. Every report requires manager approval before delivery.</p>
            </div>
            <span>{rows.length} reports</span>
          </div>

          <div className="performance-table-wrap">
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Technician</th>
                  <th>MTD / goal</th>
                  <th>Pace</th>
                  <th>Opportunities</th>
                  <th>{activeDepartment.includes("Sales") ? "Close rate" : "Rate"}</th>
                  <th>Average</th>
                  <th>Data coverage</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const progress = Math.max(0, Math.min(100, (row.goalAttainment ?? 0) * 100));
                  const targetRateLabel = row.targetRateType === "close" ? "Close" : "Conversion";

                  return (
                    <tr key={row.slug}>
                      <td>
                        <div className="performance-person">
                          <PerformanceStaffAvatar
                            imageUrl={resolveStaffHeadshotUrl(row.technician)}
                            name={row.technician}
                          />
                          <div>
                            <strong>{row.technician}</strong>
                            <span>{row.department}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="performance-goal-cell">
                          <strong>{valueOrDash(row.actual?.revenue ?? null, formatCurrency)}</strong>
                          <span>of {valueOrDash(row.monthlySalesGoal, formatCurrency)}</span>
                          <div className="performance-progress" aria-label={`${Math.round(progress)}% of goal`}>
                            <span style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`performance-status performance-status--${row.status}`}>
                          {STATUS_LABELS[row.status]}
                        </span>
                        <strong className="performance-pace">
                          {valueOrDash(row.pace, (value) => formatPercent(value, 0))}
                        </strong>
                      </td>
                      <td>
                        <strong>{valueOrDash(row.actual?.opportunities ?? null, formatNumber)}</strong>
                        <span className="performance-target">target {valueOrDash(row.targetOpportunitiesMonthly, formatNumber)}</span>
                      </td>
                      <td>
                        <strong>{valueOrDash(row.actual?.rate ?? null, (value) => formatPercent(value, 0))}</strong>
                        <span className="performance-target">{targetRateLabel} target {valueOrDash(row.targetRate, (value) => formatPercent(value, 0))}</span>
                      </td>
                      <td>
                        <strong>{valueOrDash(row.actual?.averageSale ?? null, formatCurrency)}</strong>
                        <span className="performance-target">target {valueOrDash(row.targetAverage, formatCurrency)}</span>
                      </td>
                      <td>
                        <div className="performance-source-list">
                          <span className={row.actual ? "is-ready" : "is-missing"}>ServiceTitan {row.actual ? "matched" : "missing"}</span>
                          <span className={row.fieldPro ? "is-ready" : "is-missing"}>
                            Field Pro {row.fieldPro ? `${row.fieldPro.totalRecordings ?? 0} recordings` : "missing"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <a className="performance-review-link" href={`/performance/${row.slug}`}>
                          Review report
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
