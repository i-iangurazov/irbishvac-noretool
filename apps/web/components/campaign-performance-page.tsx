import { MarketingIcon, type MarketingIconName } from "./marketing-icon";
import { MarketingOverview } from "./marketing-overview";
import { rowCategory, missingPaidSpend, rowCommissionCost, rowTotalCost, totalCommissionCost, totalAcquisitionCost, spendCoverage } from "../lib/campaign-overview";
import { DashboardShell } from "@irbis/ui";
import { formatCompactCurrency, formatNumber, formatPercent } from "@irbis/utils";
import { getBrandLogoUrl } from "../lib/assets";
import { navItems } from "../lib/api";
import { CampaignPeriodSelect } from "./campaign-period-select";
import { CampaignRefreshButton } from "./campaign-refresh-button";
import { CampaignPlanInputs } from "./campaign-plan-inputs";
import { PrintReportButton } from "./print-report-button";

type CampaignStatus = "on-track" | "watch" | "off-track" | "risk" | "unplanned";
type CampaignView = "overview" | "revenue" | "channels" | "plan" | "history";
export type CampaignCategory = "paid" | "separate-spend" | "organic" | "automation" | "partner" | "retention" | "other";
type CampaignDisplayCategory = "paid" | "separate-spend" | "organic" | "automation" | "other";
type CampaignRevenueGroup = "paid" | "unpaid" | "separate-spend" | "other";

type CampaignTargets = {
  qualifiedLeads: number;
  bookedJobs: number | null;
  spend: number | null;
  soldAmount: number | null;
  completedRevenue: number | null;
};

export type CampaignRow = {
  channel: string;
  category?: CampaignCategory;
  budgetType?: "platform" | "manual" | "prepaid" | "none";
  plan: CampaignTargets;
  forecast?: CampaignTargets | null;
  effectivePlan?: CampaignTargets;
  forecastEffectiveFrom?: string | null;
  forecastReason?: string | null;
  actual: {
    calls: number;
    forms: number;
    qualifiedLeads: number;
    bookedJobs: number;
    bookingRate: number | null;
    spend: number;
    commissionCost?: number;
    totalCost?: number;
    costPerLead: number | null;
    costPerBookedJob?: number | null;
    soldJobs: number;
    soldAmount: number;
    completedRevenue: number;
    roi: number | null;
    roas?: number | null;
  };
  leadAttainment: number | null;
  opportunityAttainment: number | null;
  pace: number | null;
  budgetPace?: number | null;
  status: CampaignStatus;
};

type CapacityAssumption = {
  team: string;
  headcount: number;
  opportunitiesPerDay: number;
  planningDays: number;
  effectiveFrom?: string | null;
  notes?: string | null;
};

export type CampaignPerformanceData = {
  revenueByDepartment?: Array<{ department: string; completedRevenue: number }>;
  leadDataStatus?: "available" | "unavailable";
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
    elapsedWorkingDays?: number;
    workingDaysInMonth?: number;
  };
  plan: {
    status: string;
    approvalStatus?: "approved" | "draft" | "required";
    version?: string;
    approvedBy?: string | null;
    approvedAt?: string | null;
    originalPlanLocked?: boolean;
    companyRevenueGoal: number;
    marketingBudgetRate: number;
    marketingBudgetGoal: number;
    qualifiedLeadGoal: number;
    opportunityGoal: number;
    targetBookingRate: number;
    channelBudgetGoalStatus: string;
    channelLeadGoalMethod?: string;
  };
  capacity?: {
    status: "connected" | "model";
    planningDays: number;
    dailyOpportunityCapacity: number;
    monthlyOpportunityCapacity: number;
    assumptions: CapacityAssumption[];
  };
  forecast?: {
    status: "active" | "not-set";
    effectiveFrom: string | null;
    reason: string | null;
    changedChannelCount: number;
  };
  nextMonthDraft?: {
    month: string;
    status: "recommendation";
    opportunityGoal: number;
    qualifiedLeadGoal: number;
    targetBookingRate: number;
    rows: Array<{ channel: string; qualifiedLeads: number; bookedJobs: number | null }>;
    note: string;
  };
  actual: {
    qualifiedLeads: number;
    bookedJobs: number;
    bookingRate: number | null;
    spend: number;
    commissionCost?: number;
    totalCost?: number;
    costPerLead: number | null;
    costPerBookedJob?: number | null;
    soldJobs: number;
    soldAmount: number;
    completedRevenue: number;
    roas?: number | null;
  };
  spendCoverage?: {
    status: "complete" | "partial" | "unavailable" | "not-applicable";
    activePaidChannels: number;
    trackedPaidChannels: number;
    missingPaidChannels: string[];
    trackedLeadShare: number | null;
    trackedPaidSpend?: number;
    trackedCommissionCost?: number;
    trackedPaidTotalCost?: number;
    trackedPaidLeads?: number;
    trackedPaidBookedJobs?: number;
    trackedPaidCompletedRevenue?: number;
    coveredCostPerLead?: number | null;
    coveredCostPerBookedJob?: number | null;
    coveredRoas?: number | null;
  };
  pace: {
    expectedToDateRatio: number;
    expectedWorkingDayRatio?: number;
    expectedCalendarDayRatio?: number;
    opportunityPace: number | null;
    qualifiedLeadPace: number | null;
    spendPace: number | null;
    projectedOpportunities: number | null;
    opportunityGap: number;
    requiredOpportunitiesPerRemainingDay: number | null;
  };
  alerts: Array<{ severity: string; channel: string; message: string }>;
  rows: CampaignRow[];
  sources: Array<{
    name: string;
    role: string;
    reportId?: string;
    status?: "connected" | "blocked" | "stale";
    refreshedAt?: string;
    rowCount?: number;
  }>;
  dataNotes?: string[];
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  "on-track": "On track",
  watch: "Watch",
  "off-track": "Off track",
  risk: "Risk",
  unplanned: "Unplanned",
};

const CATEGORY_LABEL: Record<CampaignCategory, string> = {
  paid: "Paid channels",
  "separate-spend": "Brand / ATL Marketing",
  organic: "Organic / Online Listings",
  automation: "Automation",
  retention: "Retention",
  partner: "Partner",
  other: "Other / Unmapped",
};

const REVENUE_GROUP_LABEL: Record<CampaignRevenueGroup, string> = {
  paid: "Paid channels",
  unpaid: "Unpaid / organic",
  "separate-spend": "Brand / ATL Marketing",
  other: "Other / Unmapped",
};

function formatMaybePercent(value: number | null | undefined, digits = 0) {
  return value == null ? "-" : formatPercent(value, digits);
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

function monthLabel(value: string, style: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("en-US", { month: style, year: style === "long" ? "numeric" : undefined, timeZone: "UTC" })
    .format(new Date(`${value}-01T12:00:00.000Z`));
}

function rowDisplayCategory(row: CampaignRow): CampaignDisplayCategory {
  const category = rowCategory(row);
  return category === "paid" || category === "separate-spend" || category === "organic" || category === "automation" ? category : "other";
}

function effectiveTargets(row: CampaignRow) {
  return row.effectivePlan ?? row.forecast ?? row.plan;
}

function revenueGroup(row: CampaignRow): CampaignRevenueGroup {
  const category = rowDisplayCategory(row);
  if (category === "paid" || category === "separate-spend") return category;
  if (category === "organic" || category === "automation") return "unpaid";
  return "other";
}

function periodId(data: CampaignPerformanceData) {
  return data.period.id ?? data.period.from.slice(0, 7);
}

function viewHref(month: string, view: CampaignView) {
  return `/marketing?month=${encodeURIComponent(month)}&view=${view}`;
}

function CampaignGauge({
  value,
  target = 1,
  valueLabel,
  label,
  size = "large",
}: {
  value: number | null | undefined;
  target?: number | null;
  valueLabel: string;
  label: string;
  size?: "large" | "compact" | "mini";
}) {
  const clamp = (candidate: number | null | undefined) => Math.max(0, Math.min(1, candidate ?? 0));
  const point = (candidate: number | null | undefined, radius: number) => {
    const angle = Math.PI * (1 - clamp(candidate));
    return {
      x: 60 + Math.cos(angle) * radius,
      y: 60 - Math.sin(angle) * radius,
    };
  };
  const progress = clamp(value);
  const needle = point(value, 39);
  const targetStart = point(target, 45);
  const targetEnd = point(target, 53);

  return (
    <div aria-label={label} className={`campaign-gauge campaign-gauge--${size}${value == null ? " campaign-gauge--empty" : ""}`} role="img">
      <svg aria-hidden="true" viewBox="0 0 120 80">
        <path className="campaign-gauge__track" d="M 10 60 A 50 50 0 0 1 110 60" pathLength="100" />
        <path className="campaign-gauge__progress" d="M 10 60 A 50 50 0 0 1 110 60" pathLength="100" strokeDasharray={`${progress * 100} 100`} />
        {target != null ? <line className="campaign-gauge__target" x1={targetStart.x} x2={targetEnd.x} y1={targetStart.y} y2={targetEnd.y} /> : null}
        {value != null ? <line className="campaign-gauge__needle" x1="60" x2={needle.x} y1="60" y2={needle.y} /> : null}
        <circle className="campaign-gauge__pin" cx="60" cy="60" r="3" />
      </svg>
      <span className="campaign-gauge__value">{valueLabel}</span>
    </div>
  );
}

function ChannelTable({
  rows,
  mode = "actual",
  emptyMessage = "No channel activity or plan is recorded for this month.",
}: {
  rows: CampaignRow[];
  mode?: "actual" | "plan";
  emptyMessage?: string;
}) {
  return (
    <div className="campaign-table-wrap">
      <table className={`campaign-table campaign-table--${mode}`}>
        <thead>
          {mode === "actual" ? (
            <tr>
              <th>Channel</th><th>Opportunities / target</th><th>Pace</th><th>Qualified / booking</th>
              <th>Net media cost</th><th>Commission / total</th><th>Sold</th><th>Revenue / ROAS</th><th>Status</th>
            </tr>
          ) : (
            <tr>
              <th>Channel</th><th>Class</th><th>Original leads</th><th>Original opportunities</th>
              <th>Approved budget</th><th>Forecast revision</th><th>Effective from</th><th>Reason</th>
            </tr>
          )}
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={mode === "actual" ? 9 : 8}><strong>{emptyMessage}</strong></td></tr>
          ) : null}
          {rows.map((row) => {
            const target = effectiveTargets(row);
            const costMissing = missingPaidSpend(row);
            return mode === "actual" ? (
              <tr key={row.channel}>
                <td><strong>{row.channel}</strong><span>{CATEGORY_LABEL[rowCategory(row)]} · {row.actual.calls} calls · {row.actual.forms} forms</span></td>
                <td><strong>{formatNumber(row.actual.bookedJobs)} / {target.bookedJobs ?? "-"}</strong><CampaignGauge label={`${row.channel} opportunity target attainment ${formatMaybePercent(row.opportunityAttainment)}`} size="mini" value={row.opportunityAttainment} valueLabel={formatMaybePercent(row.opportunityAttainment)} /></td>
                <td><strong>{formatMaybePercent(row.pace)}</strong><span>working-day pace</span></td>
                <td><strong>{formatNumber(row.actual.qualifiedLeads)} / {target.qualifiedLeads || "-"}</strong><span>{formatMaybePercent(row.actual.bookingRate)} booked</span></td>
                <td className={costMissing ? "campaign-cost-missing" : undefined}><strong>{costMissing ? "Not tracked" : formatCompactCurrency(row.actual.spend)}</strong><span>{costMissing ? "Billing/API cost required" : "Media spend after adjustments"}</span></td>
                <td><strong>{formatCompactCurrency(rowCommissionCost(row))}</strong><span>Total {formatCompactCurrency(rowTotalCost(row))} · CPL {row.actual.costPerLead == null ? "-" : formatCompactCurrency(row.actual.costPerLead)} · CPB {row.actual.costPerBookedJob == null ? "-" : formatCompactCurrency(row.actual.costPerBookedJob)}</span></td>
                <td><strong>{formatNumber(row.actual.soldJobs)}</strong><span>{formatCompactCurrency(row.actual.soldAmount)}</span></td>
                <td><strong>{formatCompactCurrency(row.actual.completedRevenue)}</strong><span>ROAS {row.actual.roas == null ? "-" : `${row.actual.roas.toFixed(1)}x`}</span></td>
                <td><span className={`campaign-status campaign-status--${row.status}`}>{STATUS_LABEL[row.status]}</span></td>
              </tr>
            ) : (
              <tr key={row.channel}>
                <td><strong>{row.channel}</strong><span>{row.budgetType ?? "source-derived"} cost</span></td>
                <td><span className={`campaign-category campaign-category--${rowCategory(row)}`}>{CATEGORY_LABEL[rowCategory(row)]}</span></td>
                <td><strong>{formatNumber(row.plan.qualifiedLeads)}</strong></td>
                <td><strong>{row.plan.bookedJobs == null ? "-" : formatNumber(row.plan.bookedJobs)}</strong></td>
                <td><strong>{row.plan.spend == null ? "-" : formatCompactCurrency(row.plan.spend)}</strong></td>
                <td><strong>{row.forecast ? `${formatNumber(row.forecast.qualifiedLeads)} / ${row.forecast.bookedJobs ?? "-"}` : "No revision"}</strong><span>{row.forecast?.spend == null ? "" : formatCompactCurrency(row.forecast.spend)}</span></td>
                <td><strong>{row.forecastEffectiveFrom ?? "-"}</strong></td>
                <td><span>{row.forecastReason ?? "-"}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MarketingSummaryCard({ label, value, suffix, detail, footnote, icon, highlight = false, badge }: {
  label: string;
  value: string;
  suffix?: string;
  detail: string;
  footnote?: string | undefined;
  icon: MarketingIconName;
  highlight?: boolean;
  badge?: string;
}) {
  return (
    <article className={`marketing-summary-card${highlight ? " marketing-summary-card--highlight" : ""}`}>
      <div className="marketing-summary-card-heading">
        <h3>{label}</h3>
        <span className="marketing-summary-card-icon"><MarketingIcon name={icon} size={21} /></span>
      </div>
      <div className="marketing-summary-card-value"><strong>{value}</strong>{suffix ? <span>{suffix}</span> : null}{badge ? <span className="marketing-summary-card-badge">{badge}</span> : null}</div>
      <p>{detail}</p>
      {footnote ? <small className="marketing-brand-note">{footnote}</small> : null}
    </article>
  );
}

function RevenueView({ data }: { data: CampaignPerformanceData }) {
  const groupOrder: CampaignRevenueGroup[] = ["paid", "unpaid", "other", "separate-spend"];
  const groups = groupOrder.map((group) => {
    const rows = data.rows.filter((row) => revenueGroup(row) === group);
    const completedRevenue = rows.reduce((sum, row) => sum + row.actual.completedRevenue, 0);
    const spend = rows.reduce((sum, row) => sum + row.actual.spend, 0);
    const commissionCost = rows.reduce((sum, row) => sum + rowCommissionCost(row), 0);
    const totalCost = spend + commissionCost;
    return {
      group,
      rows,
      soldJobs: rows.reduce((sum, row) => sum + row.actual.soldJobs, 0),
      soldAmount: rows.reduce((sum, row) => sum + row.actual.soldAmount, 0),
      completedRevenue,
      spend,
      commissionCost,
      totalCost,
      share: data.actual.completedRevenue > 0 ? completedRevenue / data.actual.completedRevenue : null,
    };
  });
  const coverage = spendCoverage(data);
  const channelRows = [...data.rows]
    .filter((row) => row.actual.completedRevenue > 0 || row.actual.soldAmount > 0 || rowTotalCost(row) > 0)
    .sort((left, right) => right.actual.completedRevenue - left.actual.completedRevenue || right.actual.soldAmount - left.actual.soldAmount);
  const paidGroup = groups.find((group) => group.group === "paid")!;
  const unpaidGroup = groups.find((group) => group.group === "unpaid")!;
  const otherGroup = groups.find((group) => group.group === "other")!;
  return (
    <>
      <section className="marketing-summary-cards" aria-label="Revenue summary">
        <MarketingSummaryCard label="Total completed revenue" value={formatCompactCurrency(data.actual.completedRevenue)} detail={`${formatNumber(data.actual.soldJobs)} sold jobs · ${formatCompactCurrency(data.actual.soldAmount)} sales value`} icon="sales" highlight />
        <MarketingSummaryCard label="Paid channel revenue" value={formatCompactCurrency(paidGroup.completedRevenue)} detail="Share of completed revenue" badge={formatMaybePercent(paidGroup.share)} icon="broadcast" />
        <MarketingSummaryCard label="Unpaid / organic revenue" value={formatCompactCurrency(unpaidGroup.completedRevenue)} detail="Share of completed revenue" badge={formatMaybePercent(unpaidGroup.share)} icon="users" />
        <MarketingSummaryCard label="Other / unmapped revenue" value={formatCompactCurrency(otherGroup.completedRevenue)} detail="Retained for reconciliation" badge={formatMaybePercent(otherGroup.share)} icon="layers" />
      </section>

      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading"><div><h3>Paid vs unpaid revenue</h3><p>Every ServiceTitan dollar remains visible, including channels that are not yet mapped to Emil's acquisition groups.</p></div><div className="campaign-table-panel__plan"><span>Paid cost coverage</span><strong>{coverage.trackedPaidChannels}/{coverage.activePaidChannels} channels</strong><small>{formatMaybePercent(coverage.trackedLeadShare)} of paid leads covered</small></div></div>
        <div className="campaign-table-wrap"><table className="campaign-table campaign-table--revenue-groups"><thead><tr><th>Acquisition group</th><th>Channels</th><th>Sold</th><th>Sales value</th><th>Completed revenue</th><th>Revenue share</th><th>Media / commission</th><th>All-in ROAS</th></tr></thead><tbody>
          {groups.map((group) => {
            const roas = group.group === "paid"
              ? coverage.status === "complete" ? (group.totalCost > 0 ? group.completedRevenue / group.totalCost : null) : coverage.coveredRoas
              : group.group === "other" && group.totalCost > 0 ? group.completedRevenue / group.totalCost : null;
            return <tr key={group.group}><td><strong>{REVENUE_GROUP_LABEL[group.group]}</strong><span>{group.group === "separate-spend" ? "Billboards, TV, Radio" : group.group === "unpaid" ? "Organic + Automation" : group.group === "paid" && coverage.status !== "complete" ? "ROAS uses covered paid channels" : ""}</span></td><td><strong>{formatNumber(group.rows.length)}</strong></td><td><strong>{formatNumber(group.soldJobs)}</strong></td><td><strong>{formatCompactCurrency(group.soldAmount)}</strong></td><td><strong>{formatCompactCurrency(group.completedRevenue)}</strong></td><td><strong>{formatMaybePercent(group.share)}</strong></td><td><strong>{formatCompactCurrency(group.spend)}</strong><span>{formatCompactCurrency(group.commissionCost)} commission · {formatCompactCurrency(group.totalCost)} total</span></td><td><strong>{roas == null ? "-" : `${roas.toFixed(1)}x${group.group === "paid" && coverage.status !== "complete" ? " covered" : ""}`}</strong></td></tr>;
          })}
        </tbody></table></div>
      </section>

      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading"><div><h3>Revenue by channel</h3><p>Sales value is sold estimates; completed revenue is recognized ServiceTitan revenue through the MTD cutoff.</p></div><div className="campaign-table-panel__plan"><span>Reconciled total</span><strong>{formatCompactCurrency(data.actual.completedRevenue)}</strong><small>{channelRows.length} channels with financial activity</small></div></div>
        <div className="campaign-table-wrap"><table className="campaign-table campaign-table--revenue"><thead><tr><th>Channel</th><th>Type</th><th>Sold</th><th>Sales value</th><th>Completed revenue</th><th>Revenue share</th><th>Media / commission</th><th>All-in ROAS</th></tr></thead><tbody>
          {channelRows.map((row) => <tr key={row.channel}><td><strong>{row.channel}</strong></td><td><span className={`campaign-revenue-type campaign-revenue-type--${revenueGroup(row)}`}>{REVENUE_GROUP_LABEL[revenueGroup(row)]}</span></td><td><strong>{formatNumber(row.actual.soldJobs)}</strong></td><td><strong>{formatCompactCurrency(row.actual.soldAmount)}</strong></td><td><strong>{formatCompactCurrency(row.actual.completedRevenue)}</strong></td><td><strong>{formatMaybePercent(data.actual.completedRevenue > 0 ? row.actual.completedRevenue / data.actual.completedRevenue : null)}</strong></td><td className={missingPaidSpend(row) ? "campaign-cost-missing" : undefined}><strong>{missingPaidSpend(row) ? "Missing" : formatCompactCurrency(row.actual.spend)}</strong><span>{formatCompactCurrency(rowCommissionCost(row))} commission · {formatCompactCurrency(rowTotalCost(row))} total</span></td><td><strong>{revenueGroup(row) === "separate-spend" || row.actual.roas == null ? "-" : `${row.actual.roas.toFixed(1)}x`}</strong></td></tr>)}
        </tbody></table></div>
      </section>
    </>
  );
}

function ChannelsView({ data }: { data: CampaignPerformanceData }) {
  const categories = (["paid", "separate-spend", "organic", "automation", "other"] as CampaignDisplayCategory[]).map((category) => {
    const rows = data.rows.filter((row) => rowDisplayCategory(row) === category);
    return {
      category,
      count: rows.length,
      leads: rows.reduce((sum, row) => sum + row.actual.qualifiedLeads, 0),
      booked: rows.reduce((sum, row) => sum + row.actual.bookedJobs, 0),
      spend: rows.reduce((sum, row) => sum + row.actual.spend, 0),
      commissionCost: rows.reduce((sum, row) => sum + rowCommissionCost(row), 0),
      revenue: rows.reduce((sum, row) => sum + row.actual.completedRevenue, 0),
    };
  }).filter((item) => item.category !== "other" || item.count > 0);
  return (
    <>
      <section className="marketing-summary-cards marketing-summary-cards--channels" aria-label="Channel summary">
        {categories.map((item) => <MarketingSummaryCard key={item.category} label={CATEGORY_LABEL[item.category]} value={formatNumber(item.booked)} suffix="booked" detail={`${formatNumber(item.leads)} leads · ${formatCompactCurrency(item.spend)} media · ${formatCompactCurrency(item.commissionCost)} commission · ${formatCompactCurrency(item.revenue)} revenue`} footnote={item.category === "separate-spend" ? "Billboards, TV, Radio" : undefined} icon={item.category === "paid" ? "sales" : item.category === "separate-spend" ? "broadcast" : item.category === "organic" ? "users" : item.category === "automation" ? "activity" : "layers"} highlight={item.category === "paid"} />)}
      </section>
      {categories.map((item) => (
        <section className="campaign-table-panel" key={item.category}>
          <div className="campaign-table-panel__heading"><div><h3>{CATEGORY_LABEL[item.category]}</h3><p>{item.category === "separate-spend" ? "Billboards, TV, Radio" : `${item.count} normalized channels from Google Sheet and ServiceTitan.`}</p></div><div className="campaign-table-panel__plan"><span>Booked jobs</span><strong>{formatNumber(item.booked)}</strong><small>{formatCompactCurrency(item.revenue)} revenue</small></div></div>
          <ChannelTable rows={data.rows.filter((row) => rowDisplayCategory(row) === item.category)} />
        </section>
      ))}
      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading"><div><h3>Complete action queue</h3><p>Every active campaign alert at this cutoff.</p></div><div className="campaign-table-panel__plan"><span>Open alerts</span><strong>{data.alerts.length}</strong><small>Critical first</small></div></div>
        <div className="campaign-alert-list">
          {data.alerts.map((alert) => <div className={`campaign-alert campaign-alert--${alert.severity}`} key={`${alert.channel}-${alert.message}`}><strong>{alert.channel}</strong><span>{alert.message}</span></div>)}
          {data.alerts.length === 0 ? <div className="campaign-alert campaign-alert--source"><strong>No active alerts</strong><span>All connected rules are clear at this cutoff.</span></div> : null}
        </div>
      </section>
    </>
  );
}

function PlanView({ data, inputsEnabled }: { data: CampaignPerformanceData; inputsEnabled: boolean }) {
  const assumptions = data.capacity?.assumptions ?? [];
  return (
    <>
      {inputsEnabled ? (
        <CampaignPlanInputs
          capacityRows={assumptions}
          channels={data.rows.map((row) => row.channel)}
          commissionRows={data.rows.map((row) => ({ channel: row.channel, monthlyCommission: rowCommissionCost(row) }))}
          cutoffDate={data.period.to}
          month={periodId(data)}
        />
      ) : null}
      <section className={`campaign-plan-banner campaign-plan-banner--${data.plan.approvalStatus ?? "required"}`}>
        <div><span>Original monthly plan</span><strong>{data.plan.status}</strong><small>Version {data.plan.version ?? "not connected"} · original baseline remains locked</small></div>
        <div><span>Forecast</span><strong>{data.forecast?.status === "active" ? `${data.forecast.changedChannelCount} revised channels` : "No revision"}</strong><small>{data.forecast?.effectiveFrom ? `Effective ${data.forecast.effectiveFrom}` : "Original plan remains effective"}</small></div>
        <div><span>Capacity requirement</span><strong>{formatNumber(data.capacity?.monthlyOpportunityCapacity ?? data.plan.opportunityGoal)} opportunities</strong><small>{formatNumber(data.capacity?.dailyOpportunityCapacity ?? 0)} per production day · {data.capacity?.status ?? "model"}</small></div>
      </section>

      <section className="campaign-plan-grid">
        <div className="campaign-table-panel">
          <div className="campaign-table-panel__heading"><div><h3>Capacity assumptions</h3><p>Editable in Google Sheet Capacity Plan. Changes must have an effective date.</p></div></div>
          <div className="campaign-table-wrap"><table className="campaign-table campaign-table--capacity"><thead><tr><th>Team</th><th>Headcount</th><th>Opp / day</th><th>Planning days</th><th>Monthly demand</th></tr></thead><tbody>
            {assumptions.length > 0 ? assumptions.map((row) => <tr key={row.team}><td><strong>{row.team}</strong><span>{row.notes ?? ""}</span></td><td><strong>{formatNumber(row.headcount)}</strong></td><td><strong>{row.opportunitiesPerDay}</strong></td><td><strong>{row.planningDays}</strong></td><td><strong>{formatNumber(row.headcount * row.opportunitiesPerDay * row.planningDays)}</strong></td></tr>) : <tr><td colSpan={5}><strong>Capacity Plan tab not connected</strong><span>Dashboard is using the explicitly labeled model target.</span></td></tr>}
          </tbody></table></div>
        </div>
        <div className="campaign-next-plan">
          <span>Next-month draft</span>
          <strong>{data.nextMonthDraft ? monthLabel(data.nextMonthDraft.month, "long") : "Not generated"}</strong>
          <div><b>{formatNumber(data.nextMonthDraft?.opportunityGoal ?? data.plan.opportunityGoal)}</b><small>opportunities</small></div>
          <div><b>{formatNumber(data.nextMonthDraft?.qualifiedLeadGoal ?? data.plan.qualifiedLeadGoal)}</b><small>qualified leads</small></div>
          <p>{data.nextMonthDraft?.note ?? "A recommendation will appear after the next live refresh."}</p>
          <em>Recommendation only. Tim/Emil approval is required before it becomes the original plan.</em>
        </div>
      </section>

      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading"><div><h3>Original plan and forecast ledger</h3><p>Mid-month changes never overwrite the approved original values.</p></div><div className="campaign-table-panel__plan"><span>Budget basis</span><strong>{formatCompactCurrency(data.plan.marketingBudgetGoal)}</strong><small>{data.plan.channelBudgetGoalStatus}</small></div></div>
        <ChannelTable rows={data.rows} mode="plan" />
      </section>
    </>
  );
}

function HistoryView({ history }: { history: CampaignPerformanceData[] }) {
  const sorted = [...history].sort((a, b) => periodId(a).localeCompare(periodId(b)));
  const channels = [...new Set(sorted.flatMap((period) => period.rows.map((row) => row.channel)))].map((channel) => ({
    channel,
    booked: sorted.map((period) => period.rows.find((row) => row.channel === channel)?.actual.bookedJobs ?? 0),
    revenue: sorted.map((period) => period.rows.find((row) => row.channel === channel)?.actual.completedRevenue ?? 0),
  })).sort((a, b) => b.booked.reduce((x, y) => x + y, 0) - a.booked.reduce((x, y) => x + y, 0)).slice(0, 10);
  return (
    <>
      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading"><div><h3>Monthly executive history</h3><p>Completed months and current MTD are kept separate.</p></div></div>
        <div className="campaign-table-wrap"><table className="campaign-table campaign-table--history"><thead><tr><th>Month</th><th>Qualified leads</th><th>Booked</th><th>Booking rate</th><th>Net media</th><th>Commission</th><th>Total cost</th><th>Sold</th><th>Completed revenue</th><th>Plan status</th></tr></thead><tbody>
          {sorted.map((period) => <tr key={periodId(period)}><td><strong>{monthLabel(periodId(period), "long")}</strong><span>through {period.period.to}</span></td><td><strong>{formatNumber(period.actual.qualifiedLeads)}</strong></td><td><strong>{formatNumber(period.actual.bookedJobs)}</strong></td><td><strong>{formatMaybePercent(period.actual.bookingRate)}</strong></td><td><strong>{formatCompactCurrency(period.actual.spend)}</strong></td><td><strong>{formatCompactCurrency(totalCommissionCost(period))}</strong></td><td><strong>{formatCompactCurrency(totalAcquisitionCost(period))}</strong></td><td><strong>{formatNumber(period.actual.soldJobs)}</strong></td><td><strong>{formatCompactCurrency(period.actual.completedRevenue)}</strong></td><td><span className={`campaign-plan-state campaign-plan-state--${period.plan.approvalStatus ?? "required"}`}>{period.plan.status}</span></td></tr>)}
        </tbody></table></div>
      </section>
      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading"><div><h3>Channel comparison</h3><p>Top channels by booked opportunities across available months.</p></div></div>
        <div className="campaign-table-wrap"><table className="campaign-table campaign-table--comparison"><thead><tr><th>Channel</th>{sorted.map((period) => <th key={periodId(period)}>{monthLabel(periodId(period))} booked</th>)}{sorted.map((period) => <th key={`${periodId(period)}-revenue`}>{monthLabel(periodId(period))} revenue</th>)}</tr></thead><tbody>
          {channels.map((row) => <tr key={row.channel}><td><strong>{row.channel}</strong></td>{row.booked.map((value, index) => <td key={`${row.channel}-b-${periodId(sorted[index]!)}`}><strong>{formatNumber(value)}</strong></td>)}{row.revenue.map((value, index) => <td key={`${row.channel}-r-${periodId(sorted[index]!)}`}><strong>{formatCompactCurrency(value)}</strong></td>)}</tr>)}
        </tbody></table></div>
      </section>
    </>
  );
}

export function CampaignPerformancePage({ data, periods, refreshEnabled, view, history, unavailableMonth }: {
  data: CampaignPerformanceData;
  periods: Array<{ id: string; from: string }>;
  refreshEnabled: boolean;
  view: CampaignView;
  history: CampaignPerformanceData[];
  unavailableMonth?: string | undefined;
}) {
  const month = periodId(data);
  return (
    <DashboardShell activePath="/marketing" brandLogoUrl={getBrandLogoUrl()} contentClassName="campaign-performance__main" navItems={navItems} title="Marketing" subtitle="Marketing performance" headerNavigation={<nav className="campaign-view-tabs marketing-workspace-tabs" aria-label="Marketing views">{(["overview", "revenue", "channels", "plan", "history"] as CampaignView[]).map((item) => <a aria-current={item === view ? "page" : undefined} className={item === view ? "is-active" : ""} href={viewHref(month, item)} key={item}>{item === "plan" ? "Plan & Capacity" : item[0]!.toUpperCase() + item.slice(1)}</a>)}</nav>} headerContent={<div className="campaign-performance__header-meta"><span>{data.period.label}</span><strong className={`campaign-data-status campaign-data-status--${(data.dataStatus ?? "SNAPSHOT").toLowerCase()}`}>{data.dataStatus ?? "SNAPSHOT"} DATA</strong><em>{data.plan.status}</em></div>}>
      <div className="campaign-performance" data-campaign-performance="true">
        <div className="campaign-performance__print-brand"><img alt="IRBIS HVAC" src={getBrandLogoUrl() ?? undefined} /><div><span>IRBIS Heating Air Plumbing</span><strong>Marketing Performance Dashboard</strong></div></div>
        <section className="campaign-performance__intro">
          <div className="marketing-title-copy">
            <div className="campaign-performance__eyebrow"><span>Marketing analytics</span><span className={`campaign-data-status campaign-data-status--${(data.dataStatus ?? "SNAPSHOT").toLowerCase()}`}>{data.dataStatus ?? "SNAPSHOT"} DATA</span></div>
            <h2>Marketing Performance Dashboard</h2>
            <p><span>{data.period.label} · through {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${data.period.to}T12:00:00Z`))}</span><span className="marketing-metadata-divider" aria-hidden="true" /><span className="marketing-updated"><MarketingIcon name="clock" size={14} />Updated {sourceTimestamp(data.generatedAt)}</span></p>
          </div>
          <div className="campaign-performance__controls">
            <CampaignPeriodSelect activeLabel={monthLabel(month, "long")} options={periods.map((period) => ({ id: period.id, active: period.id === month, href: viewHref(period.id, view), label: monthLabel(period.id, "long") }))} />
            <CampaignRefreshButton enabled={refreshEnabled} month={month} />
            <PrintReportButton><MarketingIcon name="download" />Export PDF</PrintReportButton>
          </div>
        </section>

        {unavailableMonth ? <p className="marketing-data-notice" role="status">{monthLabel(unavailableMonth, "long")} data is unavailable. Showing {monthLabel(month, "long")} through {data.period.to}.</p> : null}
        {data.leadDataStatus === "unavailable" ? <p className="marketing-data-notice" role="status">This month’s call-center data is unavailable. Booking and lead metrics will appear when the report is connected and refreshed.</p> : null}
        {view === "overview" ? <MarketingOverview data={data} history={history} /> : null}
        {view === "revenue" ? <RevenueView data={data} /> : null}
        {view === "channels" ? <ChannelsView data={data} /> : null}
        {view === "plan" ? <PlanView data={data} inputsEnabled={refreshEnabled} /> : null}
        {view === "history" ? <HistoryView history={history} /> : null}

        <footer className="campaign-performance__footer"><span>{data.sources.filter((source) => source.status === "connected").length}/{data.sources.length} sources connected · refreshed {sourceTimestamp(data.generatedAt)}</span><span>All reporting times are Pacific Time</span></footer>
      </div>
    </DashboardShell>
  );
}
