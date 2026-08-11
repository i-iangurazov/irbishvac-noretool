import { DashboardShell } from "@irbis/ui";
import {
  formatCompactCurrency,
  formatNumber,
  formatPercent,
} from "@irbis/utils";
import { getBrandLogoUrl } from "../lib/assets";
import { navItems } from "../lib/api";
import { PrintReportButton } from "./print-report-button";
import { CampaignRefreshButton } from "./campaign-refresh-button";

type CampaignStatus = "on-track" | "watch" | "off-track" | "risk" | "unplanned";

type CampaignRow = {
  channel: string;
  plan: {
    qualifiedLeads: number;
    bookedJobs: number | null;
    spend: number | null;
    soldAmount: number | null;
    completedRevenue: number | null;
  };
  actual: {
    calls: number;
    forms: number;
    qualifiedLeads: number;
    bookedJobs: number;
    bookingRate: number | null;
    spend: number;
    costPerLead: number | null;
    soldJobs: number;
    soldAmount: number;
    completedRevenue: number;
    roi: number | null;
  };
  leadAttainment: number | null;
  opportunityAttainment: number | null;
  pace: number | null;
  status: CampaignStatus;
};

export type CampaignPerformanceData = {
  schemaVersion?: number;
  generatedAt: string;
  dataStatus?: "LIVE" | "SNAPSHOT";
  period: {
    id?: string;
    label: string;
    from: string;
    to: string;
    elapsedCalendarDays: number;
    calendarDaysInMonth: number;
  };
  plan: {
    status: string;
    companyRevenueGoal: number;
    marketingBudgetRate: number;
    marketingBudgetGoal: number;
    qualifiedLeadGoal: number;
    opportunityGoal: number;
    targetBookingRate: number;
    channelBudgetGoalStatus: string;
    channelLeadGoalMethod?: string;
  };
  actual: {
    qualifiedLeads: number;
    bookedJobs: number;
    bookingRate: number | null;
    spend: number;
    costPerLead: number | null;
    soldJobs: number;
    soldAmount: number;
    completedRevenue: number;
  };
  pace: {
    expectedToDateRatio: number;
    opportunityPace: number | null;
    qualifiedLeadPace: number | null;
    spendPace: number | null;
    projectedOpportunities: number | null;
    opportunityGap: number;
    requiredOpportunitiesPerRemainingDay: number | null;
  };
  alerts: Array<{
    severity: string;
    channel: string;
    message: string;
  }>;
  rows: CampaignRow[];
  sources: Array<{
    name: string;
    role: string;
    reportId?: string;
    status?: "connected" | "blocked" | "stale";
    refreshedAt?: string;
    rowCount?: number;
  }>;
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  "on-track": "On track",
  watch: "Watch",
  "off-track": "Off track",
  risk: "Risk",
  unplanned: "Unplanned",
};

function formatMaybePercent(value: number | null, digits = 0) {
  return value == null ? "—" : formatPercent(value, digits);
}

function sourceTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function CampaignPerformancePage({
  data,
  periods,
  refreshEnabled,
}: {
  data: CampaignPerformanceData;
  periods: Array<{ id: string; from: string }>;
  refreshEnabled: boolean;
}) {
  const visibleRows = data.rows.slice(0, 7);
  const alertRows = data.alerts.slice(0, 3);
  const opportunityAttainment = data.plan.opportunityGoal > 0
    ? data.actual.bookedJobs / data.plan.opportunityGoal
    : null;
  const revenueAttainment = data.plan.companyRevenueGoal > 0
    ? data.actual.completedRevenue / data.plan.companyRevenueGoal
    : null;

  return (
    <DashboardShell
      activePath="/campaigns"
      brandLogoUrl={getBrandLogoUrl()}
      contentClassName="campaign-performance__main"
      navItems={navItems}
      title="Marketing Performance"
      subtitle="Campaign command center"
      headerContent={
        <div className="campaign-performance__header-meta">
          <span>{data.period.label}</span>
          <strong className={`campaign-data-status campaign-data-status--${(data.dataStatus ?? "SNAPSHOT").toLowerCase()}`}>
            {data.dataStatus ?? "SNAPSHOT"} DATA
          </strong>
          <em>{data.plan.status}</em>
        </div>
      }
    >
      <div className="campaign-performance" data-campaign-performance="true">
        <div className="campaign-performance__print-brand">
          <img alt="IRBIS HVAC" src={getBrandLogoUrl() ?? undefined} />
          <div>
            <span>IRBIS Heating Air Plumbing</span>
            <strong>Marketing Campaign Performance</strong>
          </div>
        </div>
        <section className="campaign-performance__intro">
          <div>
            <div className="campaign-performance__eyebrow">Plan / actual / pace</div>
            <h2>Campaign command center</h2>
            <p>{data.period.label} · ServiceTitan and Call Center actuals</p>
          </div>
          <div className="campaign-performance__controls">
            <div className="campaign-period-switch" aria-label="Reporting month">
              {periods.map((period) => {
                const periodId = period.id;
                return (
                  <a
                    aria-pressed={periodId === (data.period.id ?? data.period.from)}
                    className={periodId === (data.period.id ?? data.period.from) ? "is-active" : ""}
                    href={`/campaigns?month=${periodId}`}
                    key={periodId}
                  >
                    {new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(`${period.from}T12:00:00`))}
                  </a>
                );
              })}
            </div>
            <div className="campaign-cutoff">
              <span>MTD cutoff</span>
              <strong>{data.period.to}</strong>
              <small>{sourceTimestamp(data.generatedAt)}</small>
            </div>
            <CampaignRefreshButton
              enabled={refreshEnabled}
              month={data.period.id ?? data.period.from.slice(0, 7)}
            />
            <PrintReportButton />
          </div>
        </section>

        <section className="campaign-source-strip" aria-label="Connected data sources">
          {data.sources.map((source) => (
            <div className="campaign-source" key={`${source.name}-${source.reportId ?? "sheet"}`}>
              <span className={`campaign-source__state campaign-source__state--${source.status ?? "stale"}`} aria-hidden="true" />
              <div>
                <strong>{source.name}</strong>
                <small>
                  {source.status === "connected" ? "Live" : "Snapshot"}
                  {source.rowCount == null ? "" : ` · ${formatNumber(source.rowCount)} rows`}
                </small>
              </div>
            </div>
          ))}
        </section>

        <section className="campaign-scoreboard" aria-label="Marketing month-to-date summary">
          <div className="campaign-scoreboard__primary">
            <span>Booked opportunities</span>
            <div><strong>{formatNumber(data.actual.bookedJobs)}</strong><em>/ {formatNumber(data.plan.opportunityGoal)}</em></div>
            <small>{formatMaybePercent(opportunityAttainment)} achieved · {formatMaybePercent(data.pace.opportunityPace)} to month pace</small>
            <div className="campaign-scoreboard__bar"><span style={{ width: `${Math.min(100, Math.max(0, (opportunityAttainment ?? 0) * 100))}%` }} /></div>
          </div>
          <div>
            <span>Qualified lead supply</span>
            <strong>{formatNumber(data.actual.qualifiedLeads)} / {formatNumber(data.plan.qualifiedLeadGoal)}</strong>
            <small>{formatMaybePercent(data.pace.qualifiedLeadPace)} pace · {formatMaybePercent(data.actual.bookingRate)} booked</small>
          </div>
          <div>
            <span>Sales outcome</span>
            <strong>{formatNumber(data.actual.soldJobs)} sold</strong>
            <small>{formatCompactCurrency(data.actual.soldAmount)} sold amount</small>
          </div>
          <div>
            <span>Completed revenue</span>
            <strong>{formatCompactCurrency(data.actual.completedRevenue)}</strong>
            <small>{formatMaybePercent(revenueAttainment)} of {formatCompactCurrency(data.plan.companyRevenueGoal)}</small>
          </div>
          <div className="campaign-scoreboard__spend">
            <span>Tracked spend</span>
            <strong>{formatCompactCurrency(data.actual.spend)}</strong>
            <small>of {formatCompactCurrency(data.plan.marketingBudgetGoal)} · partial coverage</small>
          </div>
        </section>

        <section className="campaign-alerts" aria-label="Campaign alerts">
          <div className="campaign-alerts__label">
            <span>Action queue</span>
            <strong>{data.alerts.length}</strong>
          </div>
          {alertRows.map((alert) => (
            <div className={`campaign-alert campaign-alert--${alert.severity}`} key={`${alert.channel}-${alert.message}`}>
              <strong>{alert.channel}</strong>
              <span>{alert.message}</span>
            </div>
          ))}
          <div className="campaign-alert campaign-alert--source">
            <strong>Cost coverage</strong>
            <span>Manual channel spend is still pending.</span>
          </div>
        </section>

        <section className="campaign-table-panel" aria-label="Campaign performance table">
          <div className="campaign-table-panel__heading">
            <div>
              <h3>Priority channel performance</h3>
              <p>Live actuals · {data.plan.status.toLowerCase()} · seven highest-volume channels</p>
            </div>
            <div className="campaign-table-panel__plan">
              <span>Marketing budget</span>
              <strong>{formatCompactCurrency(data.plan.marketingBudgetGoal)}</strong>
              <small>{formatPercent(data.plan.marketingBudgetRate, 0)} of {formatCompactCurrency(data.plan.companyRevenueGoal)} · {data.plan.status.toLowerCase()}</small>
            </div>
          </div>

          <div className="campaign-table-wrap">
            <table className="campaign-table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Opportunities / plan</th>
                  <th>Pace</th>
                  <th>Qualified leads</th>
                  <th>Spend / CPL</th>
                  <th>Sold</th>
                  <th>Completed revenue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const progress = Math.max(0, Math.min(100, (row.opportunityAttainment ?? 0) * 100));
                  return (
                    <tr key={row.channel}>
                      <td>
                        <strong>{row.channel}</strong>
                        <span>{row.actual.calls} calls · {row.actual.forms} forms</span>
                      </td>
                      <td>
                        <strong>{formatNumber(row.actual.bookedJobs)} / {row.plan.bookedJobs ?? "—"}</strong>
                        <div className="campaign-progress" aria-label={`${Math.round(progress)}% of opportunity goal`}>
                          <span style={{ width: `${progress}%` }} />
                        </div>
                      </td>
                      <td>
                        <strong>{formatMaybePercent(row.pace)}</strong>
                        <span>month pace</span>
                      </td>
                      <td>
                        <strong>{formatNumber(row.actual.qualifiedLeads)} / {row.plan.qualifiedLeads || "—"}</strong>
                        <span>{formatMaybePercent(row.actual.bookingRate)} booking rate</span>
                      </td>
                      <td>
                        <strong>{formatCompactCurrency(row.actual.spend)}</strong>
                        <span>CPL {row.actual.spend > 0 && row.actual.costPerLead != null ? formatCompactCurrency(row.actual.costPerLead) : "—"} · plan {row.plan.spend == null ? "—" : formatCompactCurrency(row.plan.spend)}</span>
                      </td>
                      <td>
                        <strong>{formatNumber(row.actual.soldJobs)}</strong>
                        <span>{formatCompactCurrency(row.actual.soldAmount)}</span>
                      </td>
                      <td>
                        <strong>{formatCompactCurrency(row.actual.completedRevenue)}</strong>
                        <span>plan {row.plan.completedRevenue == null ? "—" : formatCompactCurrency(row.plan.completedRevenue)} · ROI {row.actual.roi == null ? "—" : formatPercent(row.actual.roi, 0)}</span>
                      </td>
                      <td>
                        <span className={`campaign-status campaign-status--${row.status}`}>
                          {STATUS_LABEL[row.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="campaign-performance__footer">
          <span>{data.sources.filter((source) => source.status === "connected").length}/{data.sources.length} sources live · actuals refreshed {sourceTimestamp(data.generatedAt)}</span>
          <span>{data.plan.channelLeadGoalMethod ?? data.plan.channelBudgetGoalStatus}</span>
        </footer>
      </div>
    </DashboardShell>
  );
}
