import { DashboardShell } from "@irbis/ui";
import { formatCompactCurrency, formatNumber, formatPercent } from "@irbis/utils";
import { getBrandLogoUrl } from "../lib/assets";
import { navItems } from "../lib/api";
import { CampaignRefreshButton } from "./campaign-refresh-button";
import { CampaignPlanInputs } from "./campaign-plan-inputs";
import { PrintReportButton } from "./print-report-button";

type CampaignStatus = "on-track" | "watch" | "off-track" | "risk" | "unplanned";
type CampaignView = "overview" | "revenue" | "channels" | "plan" | "history";
type CampaignCategory = "paid" | "separate-spend" | "organic" | "automation" | "partner" | "retention" | "other";
type CampaignDisplayCategory = "paid" | "separate-spend" | "organic" | "automation" | "other";
type CampaignRevenueGroup = "paid" | "unpaid" | "separate-spend" | "other";

type CampaignTargets = {
  qualifiedLeads: number;
  bookedJobs: number | null;
  spend: number | null;
  soldAmount: number | null;
  completedRevenue: number | null;
};

type CampaignRow = {
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
  "separate-spend": "Separate spend",
  organic: "Organic / Online Listings",
  automation: "Automation",
  retention: "Retention",
  partner: "Partner",
  other: "Other / Unmapped",
};

const REVENUE_GROUP_LABEL: Record<CampaignRevenueGroup, string> = {
  paid: "Paid channels",
  unpaid: "Unpaid / organic",
  "separate-spend": "Separate spend",
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

function rowCategory(row: CampaignRow): CampaignCategory {
  if (row.category) return row.category;
  if (["Yelp", "Google Ads", "Google Local Services", "Google LSA", "Facebook Ads", "Facebook", "Paid Social", "Workfuel", "Direct Mail", "Mail Shark", "Refer Pro", "Website"].includes(row.channel)) return "paid";
  if (["Billboard", "Radio"].includes(row.channel)) return "separate-spend";
  if (["669-COOLING", "Home Care", "Home Care Plan", "3rd Party Websites", "Carrier", "Rheem", "Switch Is On", "EnergySage", "CPAU", "GBP San Jose", "Existing Customers", "Email Marketing"].includes(row.channel)) return "organic";
  if (row.channel === "Hatch Campaigns") return "automation";
  if (row.channel === "Scheduling Pro") return "retention";
  if (row.channel === "Now Operator") return "partner";
  return "other";
}

function rowDisplayCategory(row: CampaignRow): CampaignDisplayCategory {
  const category = rowCategory(row);
  return category === "paid" || category === "separate-spend" || category === "organic" || category === "automation" ? category : "other";
}

function effectiveTargets(row: CampaignRow) {
  return row.effectivePlan ?? row.forecast ?? row.plan;
}

function missingPaidSpend(row: CampaignRow) {
  const active = row.actual.qualifiedLeads > 0 || row.actual.bookedJobs > 0 || row.actual.soldJobs > 0 || row.actual.completedRevenue > 0;
  return rowCategory(row) === "paid" && active && row.actual.spend === 0;
}

function spendCoverage(data: CampaignPerformanceData) {
  const activePaidRows = data.rows.filter((row) => rowCategory(row) === "paid" && (
    row.actual.qualifiedLeads > 0 || row.actual.bookedJobs > 0 || row.actual.soldJobs > 0 || row.actual.completedRevenue > 0
  ));
  const missingPaidChannels = activePaidRows.filter(missingPaidSpend).map((row) => row.channel);
  const trackedPaidRows = activePaidRows.filter((row) => row.actual.spend > 0);
  const trackedPaidChannels = trackedPaidRows.length;
  const activePaidLeads = activePaidRows.reduce((sum, row) => sum + row.actual.qualifiedLeads, 0);
  const trackedPaidLeads = trackedPaidRows.reduce((sum, row) => sum + row.actual.qualifiedLeads, 0);
  const trackedPaidSpend = trackedPaidRows.reduce((sum, row) => sum + row.actual.spend, 0);
  const trackedPaidBookedJobs = trackedPaidRows.reduce((sum, row) => sum + row.actual.bookedJobs, 0);
  const trackedPaidCompletedRevenue = trackedPaidRows.reduce((sum, row) => sum + row.actual.completedRevenue, 0);
  const derived = {
    status: activePaidRows.length === 0 ? "not-applicable" as const : missingPaidChannels.length === 0 ? "complete" as const : trackedPaidChannels === 0 ? "unavailable" as const : "partial" as const,
    activePaidChannels: activePaidRows.length,
    trackedPaidChannels,
    missingPaidChannels,
    trackedLeadShare: activePaidLeads > 0 ? trackedPaidLeads / activePaidLeads : null,
    trackedPaidSpend,
    trackedPaidLeads,
    trackedPaidBookedJobs,
    trackedPaidCompletedRevenue,
    coveredCostPerLead: trackedPaidLeads > 0 ? trackedPaidSpend / trackedPaidLeads : null,
    coveredCostPerBookedJob: trackedPaidBookedJobs > 0 ? trackedPaidSpend / trackedPaidBookedJobs : null,
    coveredRoas: trackedPaidSpend > 0 ? trackedPaidCompletedRevenue / trackedPaidSpend : null,
  };
  return { ...derived, ...data.spendCoverage };
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
  return `/campaigns?month=${encodeURIComponent(month)}&view=${view}`;
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
              <th>Spend / cost</th><th>Sold</th><th>Revenue / ROAS</th><th>Status</th>
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
            <tr><td colSpan={8}><strong>{emptyMessage}</strong></td></tr>
          ) : null}
          {rows.map((row) => {
            const target = effectiveTargets(row);
            const progress = Math.max(0, Math.min(100, (row.opportunityAttainment ?? 0) * 100));
            const costMissing = missingPaidSpend(row);
            return mode === "actual" ? (
              <tr key={row.channel}>
                <td><strong>{row.channel}</strong><span>{CATEGORY_LABEL[rowCategory(row)]} · {row.actual.calls} calls · {row.actual.forms} forms</span></td>
                <td><strong>{formatNumber(row.actual.bookedJobs)} / {target.bookedJobs ?? "-"}</strong><div className="campaign-progress"><span style={{ width: `${progress}%` }} /></div></td>
                <td><strong>{formatMaybePercent(row.pace)}</strong><span>working-day pace</span></td>
                <td><strong>{formatNumber(row.actual.qualifiedLeads)} / {target.qualifiedLeads || "-"}</strong><span>{formatMaybePercent(row.actual.bookingRate)} booked</span></td>
                <td className={costMissing ? "campaign-cost-missing" : undefined}><strong>{costMissing ? "Not tracked" : formatCompactCurrency(row.actual.spend)}</strong><span>{costMissing ? "Cost input required" : `CPL ${row.actual.costPerLead == null ? "-" : formatCompactCurrency(row.actual.costPerLead)} · CPB ${row.actual.costPerBookedJob == null ? "-" : formatCompactCurrency(row.actual.costPerBookedJob)}`}</span></td>
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

function OverviewView({ data }: { data: CampaignPerformanceData }) {
  const opportunityAttainment = data.plan.opportunityGoal > 0 ? data.actual.bookedJobs / data.plan.opportunityGoal : null;
  const revenueAttainment = data.plan.companyRevenueGoal > 0 ? data.actual.completedRevenue / data.plan.companyRevenueGoal : null;
  const leadAttainment = data.plan.qualifiedLeadGoal > 0 ? data.actual.qualifiedLeads / data.plan.qualifiedLeadGoal : null;
  const budgetAttainment = data.plan.marketingBudgetGoal > 0 ? data.actual.spend / data.plan.marketingBudgetGoal : null;
  const paidRows = data.rows.filter((row) => rowDisplayCategory(row) === "paid");
  const separateSpendRows = data.rows.filter((row) => rowDisplayCategory(row) === "separate-spend");
  const organicRows = data.rows.filter((row) => rowDisplayCategory(row) === "organic");
  const automationRows = data.rows.filter((row) => rowDisplayCategory(row) === "automation");
  const bookingRateFor = (rows: CampaignRow[]) => {
    const leads = rows.reduce((sum, row) => sum + row.actual.qualifiedLeads, 0);
    const booked = rows.reduce((sum, row) => sum + row.actual.bookedJobs, 0);
    return leads > 0 ? booked / leads : null;
  };
  const coverage = spendCoverage(data);
  const costsComplete = coverage.status === "complete";
  const costPerLead = costsComplete ? data.actual.costPerLead : coverage.coveredCostPerLead;
  const costPerBookedJob = costsComplete ? data.actual.costPerBookedJob : coverage.coveredCostPerBookedJob;
  const roas = costsComplete ? data.actual.roas ?? null : coverage.coveredRoas;
  const costMetricPrefix = costsComplete ? "" : "Covered ";
  const coverageLabel = `${coverage.trackedPaidChannels}/${coverage.activePaidChannels} paid channels · ${formatMaybePercent(coverage.trackedLeadShare)} of paid leads`;
  const targetLabel = data.plan.approvalStatus === "approved" ? "Target" : "Model target";
  const progressWidth = (value: number | null) => `${Math.min(100, Math.max(0, (value ?? 0) * 100))}%`;
  return (
    <>
      <section className="campaign-executive-grid" aria-label="Marketing month-to-date executive summary">
        <div className="campaign-executive-card campaign-executive-card--revenue">
          <span>Revenue</span>
          <strong>{formatCompactCurrency(data.actual.completedRevenue)}</strong>
          <small>{targetLabel} {formatCompactCurrency(data.plan.companyRevenueGoal)} · {formatMaybePercent(revenueAttainment)} achieved</small>
          <div className="campaign-executive-meter"><span style={{ width: progressWidth(revenueAttainment) }} /></div>
        </div>
        <div className="campaign-executive-card campaign-executive-card--sales">
          <div><span>Sold estimates</span><strong>{formatNumber(data.actual.soldJobs)}</strong></div>
          <div><span>Sales value</span><strong>{formatCompactCurrency(data.actual.soldAmount)}</strong></div>
        </div>
        <div className="campaign-executive-card campaign-executive-card--flow">
          <div><span>Qualified leads</span><strong>{formatNumber(data.actual.qualifiedLeads)} / {formatNumber(data.plan.qualifiedLeadGoal)}</strong><small>{formatMaybePercent(data.pace.qualifiedLeadPace)} pace</small></div>
          <div className="campaign-executive-meter"><span style={{ width: progressWidth(leadAttainment) }} /></div>
          <div><span>Booked jobs</span><strong>{formatNumber(data.actual.bookedJobs)} / {formatNumber(data.plan.opportunityGoal)}</strong><small>{formatMaybePercent(data.pace.opportunityPace)} pace</small></div>
          <div className="campaign-executive-meter"><span style={{ width: progressWidth(opportunityAttainment) }} /></div>
        </div>
        <div className="campaign-executive-card campaign-executive-card--booking">
          <span>Booking rate</span>
          <strong>{formatMaybePercent(data.actual.bookingRate)}</strong>
          <small>{targetLabel} {formatMaybePercent(data.plan.targetBookingRate)}</small>
          <div className="campaign-executive-split"><span>Paid <b>{formatMaybePercent(bookingRateFor(paidRows))}</b></span><span>Organic <b>{formatMaybePercent(bookingRateFor(organicRows))}</b></span></div>
        </div>
        <div className="campaign-executive-card campaign-executive-card--spend">
          <span>Tracked marketing spend</span>
          <strong>{formatCompactCurrency(data.actual.spend)} / {formatCompactCurrency(data.plan.marketingBudgetGoal)}</strong>
          <small>{costsComplete ? `${formatMaybePercent(data.pace.spendPace)} calendar pace` : coverageLabel}</small>
          <div className="campaign-executive-meter"><span style={{ width: progressWidth(budgetAttainment) }} /></div>
          <div className="campaign-executive-split"><span>{costMetricPrefix}cost / lead <b>{costPerLead == null ? "Pending" : formatCompactCurrency(costPerLead)}</b></span><span>{costMetricPrefix}cost / booked job <b>{costPerBookedJob == null ? "Pending" : formatCompactCurrency(costPerBookedJob)}</b></span></div>
        </div>
        <div className="campaign-executive-card campaign-executive-card--roas">
          <span>{costMetricPrefix}ROAS</span>
          <strong>{roas == null ? "Pending" : `${roas.toFixed(1)}x`}</strong>
          <small>{costsComplete ? "Completed revenue / tracked spend" : `${coverage.missingPaidChannels.length} paid channel costs missing · covered channels only`}</small>
        </div>
      </section>

      <section className="campaign-alerts" aria-label="Campaign alerts">
        <div className="campaign-alerts__label"><span>Action queue</span><strong>{data.alerts.length}</strong></div>
        {data.alerts.slice(0, 4).map((alert) => <div className={`campaign-alert campaign-alert--${alert.severity}`} key={`${alert.channel}-${alert.message}`}><strong>{alert.channel}</strong><span>{alert.message}</span></div>)}
        {data.alerts.length === 0 ? <div className="campaign-alert campaign-alert--source"><strong>No active alerts</strong><span>All connected rules are clear at this cutoff.</span></div> : null}
      </section>

      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading"><div><h3>Paid channels performance</h3><p>Plan, actual spend, lead flow, sold value and completed revenue.</p></div><div className="campaign-table-panel__plan"><span>Plan authority</span><strong>{data.plan.approvalStatus === "approved" ? "Approved" : "Not approved"}</strong><small>{data.plan.status}</small></div></div>
        <ChannelTable rows={paidRows} />
      </section>

      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading"><div><h3>Separate spend</h3><p>Billboard and radio costs tracked outside lead-generating channel performance.</p></div></div>
        <ChannelTable emptyMessage="No billboard or radio spend is recorded for this month." rows={separateSpendRows} />
      </section>

      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading"><div><h3>Organic / Online Listings</h3><p>Organic demand, existing customers and third-party listing contribution.</p></div></div>
        <ChannelTable rows={organicRows} />
      </section>

      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading"><div><h3>Automation</h3><p>Lead and revenue contribution generated through Hatch automation.</p></div></div>
        <ChannelTable emptyMessage="No Hatch automation activity is recorded for this month." rows={automationRows} />
      </section>
    </>
  );
}

function RevenueView({ data }: { data: CampaignPerformanceData }) {
  const groupOrder: CampaignRevenueGroup[] = ["paid", "unpaid", "other", "separate-spend"];
  const groups = groupOrder.map((group) => {
    const rows = data.rows.filter((row) => revenueGroup(row) === group);
    const completedRevenue = rows.reduce((sum, row) => sum + row.actual.completedRevenue, 0);
    const spend = rows.reduce((sum, row) => sum + row.actual.spend, 0);
    return {
      group,
      rows,
      soldJobs: rows.reduce((sum, row) => sum + row.actual.soldJobs, 0),
      soldAmount: rows.reduce((sum, row) => sum + row.actual.soldAmount, 0),
      completedRevenue,
      spend,
      share: data.actual.completedRevenue > 0 ? completedRevenue / data.actual.completedRevenue : null,
    };
  });
  const coverage = spendCoverage(data);
  const channelRows = [...data.rows]
    .filter((row) => row.actual.completedRevenue > 0 || row.actual.soldAmount > 0 || row.actual.spend > 0)
    .sort((left, right) => right.actual.completedRevenue - left.actual.completedRevenue || right.actual.soldAmount - left.actual.soldAmount);
  const paidGroup = groups.find((group) => group.group === "paid")!;
  const unpaidGroup = groups.find((group) => group.group === "unpaid")!;
  const otherGroup = groups.find((group) => group.group === "other")!;
  return (
    <>
      <section className="campaign-category-strip campaign-revenue-summary" aria-label="Paid and unpaid revenue summary">
        <div><span>Total completed revenue</span><strong>{formatCompactCurrency(data.actual.completedRevenue)}</strong><small>{formatNumber(data.actual.soldJobs)} sold jobs · {formatCompactCurrency(data.actual.soldAmount)} sales value</small></div>
        <div><span>Paid channel revenue</span><strong>{formatCompactCurrency(paidGroup.completedRevenue)}</strong><small>{formatMaybePercent(paidGroup.share)} of completed revenue</small></div>
        <div><span>Unpaid / organic revenue</span><strong>{formatCompactCurrency(unpaidGroup.completedRevenue)}</strong><small>{formatMaybePercent(unpaidGroup.share)} of completed revenue</small></div>
        <div><span>Other / unmapped revenue</span><strong>{formatCompactCurrency(otherGroup.completedRevenue)}</strong><small>{formatMaybePercent(otherGroup.share)} retained for reconciliation</small></div>
      </section>

      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading"><div><h3>Paid vs unpaid revenue</h3><p>Every ServiceTitan dollar remains visible, including channels that are not yet mapped to Emil's acquisition groups.</p></div><div className="campaign-table-panel__plan"><span>Paid cost coverage</span><strong>{coverage.trackedPaidChannels}/{coverage.activePaidChannels} channels</strong><small>{formatMaybePercent(coverage.trackedLeadShare)} of paid leads covered</small></div></div>
        <div className="campaign-table-wrap"><table className="campaign-table campaign-table--revenue-groups"><thead><tr><th>Acquisition group</th><th>Channels</th><th>Sold</th><th>Sales value</th><th>Completed revenue</th><th>Revenue share</th><th>Tracked spend</th><th>ROAS</th></tr></thead><tbody>
          {groups.map((group) => {
            const roas = group.group === "paid"
              ? coverage.status === "complete" ? (group.spend > 0 ? group.completedRevenue / group.spend : null) : coverage.coveredRoas
              : group.group === "other" && group.spend > 0 ? group.completedRevenue / group.spend : null;
            return <tr key={group.group}><td><strong>{REVENUE_GROUP_LABEL[group.group]}</strong><span>{group.group === "unpaid" ? "Organic + Automation" : group.group === "paid" && coverage.status !== "complete" ? "ROAS uses covered paid channels" : ""}</span></td><td><strong>{formatNumber(group.rows.length)}</strong></td><td><strong>{formatNumber(group.soldJobs)}</strong></td><td><strong>{formatCompactCurrency(group.soldAmount)}</strong></td><td><strong>{formatCompactCurrency(group.completedRevenue)}</strong></td><td><strong>{formatMaybePercent(group.share)}</strong></td><td><strong>{formatCompactCurrency(group.spend)}</strong></td><td><strong>{roas == null ? "-" : `${roas.toFixed(1)}x${group.group === "paid" && coverage.status !== "complete" ? " covered" : ""}`}</strong></td></tr>;
          })}
        </tbody></table></div>
      </section>

      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading"><div><h3>Revenue by channel</h3><p>Sales value is sold estimates; completed revenue is recognized ServiceTitan revenue through the MTD cutoff.</p></div><div className="campaign-table-panel__plan"><span>Reconciled total</span><strong>{formatCompactCurrency(data.actual.completedRevenue)}</strong><small>{channelRows.length} channels with financial activity</small></div></div>
        <div className="campaign-table-wrap"><table className="campaign-table campaign-table--revenue"><thead><tr><th>Channel</th><th>Type</th><th>Sold</th><th>Sales value</th><th>Completed revenue</th><th>Revenue share</th><th>Tracked spend</th><th>ROAS</th></tr></thead><tbody>
          {channelRows.map((row) => <tr key={row.channel}><td><strong>{row.channel}</strong></td><td><span className={`campaign-revenue-type campaign-revenue-type--${revenueGroup(row)}`}>{REVENUE_GROUP_LABEL[revenueGroup(row)]}</span></td><td><strong>{formatNumber(row.actual.soldJobs)}</strong></td><td><strong>{formatCompactCurrency(row.actual.soldAmount)}</strong></td><td><strong>{formatCompactCurrency(row.actual.completedRevenue)}</strong></td><td><strong>{formatMaybePercent(data.actual.completedRevenue > 0 ? row.actual.completedRevenue / data.actual.completedRevenue : null)}</strong></td><td className={missingPaidSpend(row) ? "campaign-cost-missing" : undefined}><strong>{missingPaidSpend(row) ? "Missing" : formatCompactCurrency(row.actual.spend)}</strong></td><td><strong>{row.actual.roas == null ? "-" : `${row.actual.roas.toFixed(1)}x`}</strong></td></tr>)}
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
      revenue: rows.reduce((sum, row) => sum + row.actual.completedRevenue, 0),
    };
  }).filter((item) => item.category !== "other" || item.count > 0);
  return (
    <>
      <section className="campaign-category-strip">
        {categories.map((item) => <div key={item.category}><span>{CATEGORY_LABEL[item.category]}</span><strong>{formatNumber(item.booked)} booked</strong><small>{formatNumber(item.leads)} leads · {formatCompactCurrency(item.spend)} tracked spend · {formatCompactCurrency(item.revenue)} revenue</small></div>)}
      </section>
      {categories.map((item) => (
        <section className="campaign-table-panel" key={item.category}>
          <div className="campaign-table-panel__heading"><div><h3>{CATEGORY_LABEL[item.category]}</h3><p>{item.count} normalized channels from Google Sheet and ServiceTitan.</p></div><div className="campaign-table-panel__plan"><span>Booked jobs</span><strong>{formatNumber(item.booked)}</strong><small>{formatCompactCurrency(item.revenue)} revenue</small></div></div>
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
        <div className="campaign-table-wrap"><table className="campaign-table campaign-table--history"><thead><tr><th>Month</th><th>Qualified leads</th><th>Booked</th><th>Booking rate</th><th>Tracked spend</th><th>Sold</th><th>Completed revenue</th><th>Plan status</th></tr></thead><tbody>
          {sorted.map((period) => <tr key={periodId(period)}><td><strong>{monthLabel(periodId(period), "long")}</strong><span>through {period.period.to}</span></td><td><strong>{formatNumber(period.actual.qualifiedLeads)}</strong></td><td><strong>{formatNumber(period.actual.bookedJobs)}</strong></td><td><strong>{formatMaybePercent(period.actual.bookingRate)}</strong></td><td><strong>{formatCompactCurrency(period.actual.spend)}</strong></td><td><strong>{formatNumber(period.actual.soldJobs)}</strong></td><td><strong>{formatCompactCurrency(period.actual.completedRevenue)}</strong></td><td><span className={`campaign-plan-state campaign-plan-state--${period.plan.approvalStatus ?? "required"}`}>{period.plan.status}</span></td></tr>)}
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

export function CampaignPerformancePage({ data, periods, refreshEnabled, view, history }: {
  data: CampaignPerformanceData;
  periods: Array<{ id: string; from: string }>;
  refreshEnabled: boolean;
  view: CampaignView;
  history: CampaignPerformanceData[];
}) {
  const month = periodId(data);
  return (
    <DashboardShell activePath="/campaigns" brandLogoUrl={getBrandLogoUrl()} contentClassName="campaign-performance__main" navItems={navItems} title="Marketing Performance" subtitle="Campaign command center" headerContent={<div className="campaign-performance__header-meta"><span>{data.period.label}</span><strong className={`campaign-data-status campaign-data-status--${(data.dataStatus ?? "SNAPSHOT").toLowerCase()}`}>{data.dataStatus ?? "SNAPSHOT"} DATA</strong><em>{data.plan.status}</em></div>}>
      <div className="campaign-performance" data-campaign-performance="true">
        <div className="campaign-performance__print-brand"><img alt="IRBIS HVAC" src={getBrandLogoUrl() ?? undefined} /><div><span>IRBIS Heating Air Plumbing</span><strong>Marketing Campaign Performance</strong></div></div>
        <section className="campaign-performance__intro">
          <div><div className="campaign-performance__eyebrow">Plan / actual / forecast</div><h2>Campaign command center</h2><p>{data.period.label} through {data.period.to} · {data.period.elapsedWorkingDays ?? "-"}/{data.period.workingDaysInMonth ?? "-"} working days</p></div>
          <div className="campaign-performance__controls">
            <div className="campaign-period-switch" aria-label="Reporting month">{periods.map((period) => <a aria-pressed={period.id === month} className={period.id === month ? "is-active" : ""} href={viewHref(period.id, view)} key={period.id}>{monthLabel(period.id)}</a>)}</div>
            <div className="campaign-cutoff"><span>MTD cutoff</span><strong>{data.period.to}</strong><small>{sourceTimestamp(data.generatedAt)}</small></div>
            <CampaignRefreshButton enabled={refreshEnabled} month={month} />
            <PrintReportButton />
          </div>
        </section>

        <nav className="campaign-view-tabs" aria-label="Campaign workspace views">{(["overview", "revenue", "channels", "plan", "history"] as CampaignView[]).map((item) => <a aria-current={item === view ? "page" : undefined} className={item === view ? "is-active" : ""} href={viewHref(month, item)} key={item}>{item === "plan" ? "Plan & capacity" : item === "history" ? "History" : item[0]!.toUpperCase() + item.slice(1)}</a>)}</nav>

        <section className="campaign-source-strip" aria-label="Connected data sources">{data.sources.map((source) => <div className="campaign-source" key={`${source.name}-${source.reportId ?? "sheet"}`}><span className={`campaign-source__state campaign-source__state--${source.status ?? "stale"}`} /><div><strong>{source.name}</strong><small>{source.status === "connected" ? "Live" : source.status === "blocked" ? "Input required" : "Snapshot"}{source.rowCount == null ? "" : ` · ${formatNumber(source.rowCount)} rows`}</small></div></div>)}</section>

        {view === "overview" ? <OverviewView data={data} /> : null}
        {view === "revenue" ? <RevenueView data={data} /> : null}
        {view === "channels" ? <ChannelsView data={data} /> : null}
        {view === "plan" ? <PlanView data={data} inputsEnabled={refreshEnabled} /> : null}
        {view === "history" ? <HistoryView history={history} /> : null}

        <footer className="campaign-performance__footer"><span>{data.sources.filter((source) => source.status === "connected").length}/{data.sources.length} sources connected · refreshed {sourceTimestamp(data.generatedAt)}</span><span>Lead pace: weekdays · spend pace: calendar days · original plan locked</span></footer>
      </div>
    </DashboardShell>
  );
}
