import { pickFirst, resolveTabularReport, toNumber } from "../shared/report";

export type CampaignPerformanceStatus = "on-track" | "watch" | "off-track" | "risk" | "unplanned";
export type CampaignChannelCategory =
  | "paid"
  | "separate-spend"
  | "organic"
  | "automation"
  | "partner"
  | "retention"
  | "other";
export type CampaignBudgetType = "platform" | "manual" | "prepaid" | "none";

export type CampaignMetricTargets = {
  qualifiedLeads: number;
  bookedJobs: number | null;
  spend: number | null;
  soldAmount: number | null;
  completedRevenue: number | null;
};

export type CampaignPlanRow = CampaignMetricTargets & {
  channel: string;
  category?: CampaignChannelCategory;
  budgetType?: CampaignBudgetType;
  notes?: string | null;
};

export type CampaignForecastRow = CampaignPlanRow & {
  effectiveFrom?: string | null;
  reason?: string | null;
};

export type CampaignCapacityAssumption = {
  team: string;
  headcount: number;
  opportunitiesPerDay: number;
  planningDays: number;
  effectiveFrom?: string | null;
  notes?: string | null;
};

export type CampaignManualCostRow = {
  channel: string;
  spend: number;
  budgetType?: CampaignBudgetType;
  effectiveFrom?: string | null;
  notes?: string | null;
};

export type CampaignPlanApproval = {
  approvalStatus: "approved" | "draft" | "required";
  version: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
};

export type CampaignActual = {
  calls: number;
  forms: number;
  qualifiedLeads: number;
  bookedJobs: number;
  bookingRate: number | null;
  spend: number;
  costPerLead: number | null;
  costPerBookedJob: number | null;
  soldJobs: number;
  soldAmount: number;
  completedRevenue: number;
  roi: number | null;
  roas: number | null;
};

export type CampaignPerformanceRow = {
  channel: string;
  category: CampaignChannelCategory;
  budgetType: CampaignBudgetType;
  plan: CampaignMetricTargets;
  forecast: CampaignMetricTargets | null;
  effectivePlan: CampaignMetricTargets;
  forecastEffectiveFrom: string | null;
  forecastReason: string | null;
  actual: CampaignActual;
  leadAttainment: number | null;
  opportunityAttainment: number | null;
  pace: number | null;
  budgetPace: number | null;
  status: CampaignPerformanceStatus;
};

export type CampaignPerformanceSource = {
  name: string;
  role: string;
  reportId?: string;
  status: "connected" | "blocked" | "stale";
  refreshedAt: string;
  rowCount?: number;
};

export type CampaignPerformanceSnapshot = {
  schemaVersion: number;
  generatedAt: string;
  dataStatus: "LIVE" | "SNAPSHOT";
  period: {
    id: string;
    label: string;
    from: string;
    to: string;
    elapsedCalendarDays: number;
    calendarDaysInMonth: number;
    elapsedWorkingDays: number;
    workingDaysInMonth: number;
  };
  plan: CampaignPlanApproval & {
    status: string;
    originalPlanLocked: boolean;
    companyRevenueGoal: number;
    marketingBudgetRate: number;
    marketingBudgetGoal: number;
    qualifiedLeadGoal: number;
    opportunityGoal: number;
    targetBookingRate: number;
    channelBudgetGoalStatus: string;
    channelLeadGoalMethod: string;
  };
  capacity: {
    status: "connected" | "model";
    planningDays: number;
    dailyOpportunityCapacity: number;
    monthlyOpportunityCapacity: number;
    assumptions: CampaignCapacityAssumption[];
  };
  forecast: {
    status: "active" | "not-set";
    effectiveFrom: string | null;
    reason: string | null;
    changedChannelCount: number;
  };
  nextMonthDraft: {
    month: string;
    status: "recommendation";
    opportunityGoal: number;
    qualifiedLeadGoal: number;
    targetBookingRate: number;
    rows: CampaignPlanRow[];
    note: string;
  };
  actual: CampaignActual;
  spendCoverage: {
    status: "complete" | "partial" | "unavailable" | "not-applicable";
    activePaidChannels: number;
    trackedPaidChannels: number;
    missingPaidChannels: string[];
    trackedLeadShare: number | null;
  };
  pace: {
    expectedToDateRatio: number;
    expectedWorkingDayRatio: number;
    expectedCalendarDayRatio: number;
    opportunityPace: number | null;
    qualifiedLeadPace: number | null;
    spendPace: number | null;
    projectedOpportunities: number | null;
    opportunityGap: number;
    requiredOpportunitiesPerRemainingDay: number | null;
  };
  alerts: Array<{ severity: "critical" | "warning"; channel: string; message: string }>;
  rows: CampaignPerformanceRow[];
  sources: CampaignPerformanceSource[];
  dataNotes: string[];
};

export type BuildCampaignPerformanceInput = {
  month: string;
  cutoff: string;
  generatedAt?: string;
  callCenterValues: unknown[][];
  campaignSummary: unknown;
  soldEstimates: unknown;
  revenueByCampaign: unknown;
  planRows: CampaignPlanRow[];
  forecastRows?: CampaignForecastRow[];
  manualCostRows?: CampaignManualCostRow[];
  connectedPlanRowCount?: number;
  connectedCostRowCount?: number;
  capacityAssumptions?: CampaignCapacityAssumption[];
  capacityStatus?: "connected" | "model";
  planApproval?: CampaignPlanApproval;
  forecastReason?: string | null;
  companyRevenueGoal: number;
  marketingBudgetRate: number;
  qualifiedLeadGoal: number;
  opportunityGoal: number;
  targetBookingRate: number;
  planStatus: string;
  channelLeadGoalMethod: string;
  channelBudgetGoalStatus: string;
  sourceReportIds: {
    campaignSummary: string;
    soldEstimates: string;
    revenueByCampaign: string;
  };
};

type MutableActual = Omit<CampaignActual, "bookingRate" | "costPerLead" | "costPerBookedJob" | "roi" | "roas">;

const EMPTY_ACTUAL: MutableActual = {
  calls: 0,
  forms: 0,
  qualifiedLeads: 0,
  bookedJobs: 0,
  spend: 0,
  soldJobs: 0,
  soldAmount: 0,
  completedRevenue: 0
};

const EMPTY_TARGETS: CampaignMetricTargets = {
  qualifiedLeads: 0,
  bookedJobs: null,
  spend: null,
  soldAmount: null,
  completedRevenue: null
};

const SUMMARY_ALIASES = {
  channel: ["Name", "Campaign Name", "Campaign", "Source", "Channel"],
  spend: ["Cost", "Campaign Cost", "Spend", "AdSpend", "MarketingSpend"],
  completedRevenue: ["CompletedRevenue", "Completed Revenue", "Revenue"]
};

const SOLD_ALIASES = {
  channel: ["ParentJobCampaign", "Parent Job Campaign", "Campaign"],
  amount: ["Total", "Sold Amount", "Amount"]
};

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function daysInMonth(month: string) {
  const [year = 0, monthNumber = 0] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function nextMonth(month: string) {
  const [year = 0, monthNumber = 0] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 1));
  return date.toISOString().slice(0, 7);
}

export function countWeekdays(from: string, to: string) {
  const start = new Date(`${from}T12:00:00.000Z`);
  const end = new Date(`${to}T12:00:00.000Z`);
  let result = 0;
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) result += 1;
  }
  return result;
}

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function normalizeCampaignChannel(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) return "Miscellaneous";

  const rules: Array<[string, string[]]> = [
    ["Yelp", ["yelp"]],
    ["Google Local Services", ["google local services", "google lsa", "lsa"]],
    ["3rd Party Websites", ["3rd party website", "third party website", "carrier", "rheem", "switch is on", "energysage", "energy sage", "cpau"]],
    ["Website", ["direct web traffic", "google organic", "website"]],
    ["GBP San Jose", ["gbp san jose", "google business"]],
    ["Google Ads", ["google ads", "google ad extension", "maxconv", "pmax", "irbis |"]],
    ["Facebook Ads", ["facebook", "paid social", "instagram", "social"]],
    ["Billboard", ["billboard"]],
    ["Radio", ["radio"]],
    ["Direct Mail", ["mail shark", "direct mail", "lettrlabs", "letterlabs", "postcard"]],
    ["Hatch Campaigns", ["hatch"]],
    ["Workfuel", ["workfuel", "work fuel"]],
    ["669-COOLING", ["669-cooling", "669 cooling"]],
    ["Scheduling Pro", ["scheduling pro"]],
    ["Home Care", ["home care"]],
    ["Existing Customers", ["existing customer"]],
    ["Email Marketing", ["email marketing", "email campaign"]],
    ["Now Operator", ["now operator"]],
    ["Refer Pro", ["refer pro"]],
    ["Appfolio", ["appfolio"]],
    ["Diamond Certified", ["diamond certified"]],
    ["SMS Campaigns", ["sms -", "sms campaign"]],
    ["Reserve with Google", ["reserve with google"]],
    ["Miscellaneous", ["miscellaneous", "recall", "warranty"]]
  ];

  return rules.find(([, markers]) => markers.some((marker) => normalized.includes(marker)))?.[0] ?? "Other";
}

export function inferCampaignCategory(channel: string): CampaignChannelCategory {
  if (["Yelp", "Google Ads", "Google Local Services", "Facebook Ads", "Workfuel", "Direct Mail", "Refer Pro", "Website"].includes(channel)) return "paid";
  if (["Billboard", "Radio"].includes(channel)) return "separate-spend";
  if (["669-COOLING", "Home Care", "3rd Party Websites", "GBP San Jose", "Existing Customers", "Email Marketing"].includes(channel)) return "organic";
  if (channel === "Hatch Campaigns") return "automation";
  if (["Scheduling Pro", "SMS Campaigns"].includes(channel)) return "retention";
  if (["Now Operator", "Appfolio", "Diamond Certified"].includes(channel)) return "partner";
  if (channel === "Reserve with Google") return "organic";
  return "other";
}

export function inferCampaignBudgetType(
  channel: string,
  category: CampaignChannelCategory = inferCampaignCategory(channel),
): CampaignBudgetType {
  if (category === "separate-spend") return "manual";
  if (category !== "paid") return "none";
  if (channel === "Direct Mail") return "prepaid";
  if (channel === "Workfuel") return "manual";
  return "platform";
}

function parseSheetDateKey(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000).toISOString().slice(0, 10);
  }
  const raw = String(value ?? "").trim();
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${String(us[1]).padStart(2, "0")}-${String(us[2]).padStart(2, "0")}`;
  return null;
}

function findColumn(headers: unknown[], aliases: string[], fallback: number) {
  const normalizedAliases = aliases.map(normalizeText);
  const index = headers.findIndex((header) => normalizedAliases.includes(normalizeText(header)));
  return index >= 0 ? index : fallback;
}

function callCenterActuals(values: unknown[][], month: string, cutoff: string) {
  const map = new Map<string, MutableActual>();
  const headers = values[0] ?? [];
  const dateIndex = findColumn(headers, ["Date Received", "Lead received", "Received", "Date"], 3);
  const mediumIndex = findColumn(headers, ["Medium", "Contact Type", "Call/Text"], 6);
  const qualityIndex = findColumn(headers, ["Lead Quality", "Quality", "Opportunity"], 7);
  const stageIndex = findColumn(headers, ["Stage", "Status"], 8);
  const channelIndex = findColumn(headers, ["Lead Source", "Campaign", "Channel", "Source"], 13);

  for (const row of values.slice(1)) {
    const dateKey = parseSheetDateKey(row[dateIndex]);
    if (!dateKey || !dateKey.startsWith(month) || dateKey > cutoff) continue;
    const channel = normalizeCampaignChannel(row[channelIndex]);
    const actual = map.get(channel) ?? { ...EMPTY_ACTUAL };
    const medium = normalizeText(row[mediumIndex]);
    const quality = normalizeText(row[qualityIndex]);
    const stage = normalizeText(row[stageIndex]);
    actual.calls += Number(medium === "call");
    actual.forms += Number(medium === "text" || medium === "form");
    actual.qualifiedLeads += Number(quality === "good" || quality === "mid");
    actual.bookedJobs += Number(stage === "booked");
    map.set(channel, actual);
  }
  return map;
}

function applyCampaignSummary(target: Map<string, MutableActual>, payload: unknown) {
  const report = resolveTabularReport(payload);
  for (const row of report.rows) {
    const channel = normalizeCampaignChannel(pickFirst(row, SUMMARY_ALIASES.channel));
    const actual = target.get(channel) ?? { ...EMPTY_ACTUAL };
    actual.spend += toNumber(pickFirst(row, SUMMARY_ALIASES.spend));
    actual.completedRevenue += toNumber(pickFirst(row, SUMMARY_ALIASES.completedRevenue));
    target.set(channel, actual);
  }
  return report.rows.length;
}

function applyRevenueByCampaign(target: Map<string, MutableActual>, payload: unknown) {
  const report = resolveTabularReport(payload);
  const revenue = new Map<string, number>();
  for (const row of report.rows) {
    const channel = normalizeCampaignChannel(pickFirst(row, SUMMARY_ALIASES.channel));
    revenue.set(channel, (revenue.get(channel) ?? 0) + toNumber(pickFirst(row, SUMMARY_ALIASES.completedRevenue)));
  }
  for (const [channel, completedRevenue] of revenue) {
    const actual = target.get(channel) ?? { ...EMPTY_ACTUAL };
    actual.completedRevenue = completedRevenue;
    target.set(channel, actual);
  }
  return report.rows.length;
}

function applySoldEstimates(target: Map<string, MutableActual>, payload: unknown) {
  const report = resolveTabularReport(payload);
  for (const row of report.rows) {
    const channel = normalizeCampaignChannel(pickFirst(row, SOLD_ALIASES.channel));
    const actual = target.get(channel) ?? { ...EMPTY_ACTUAL };
    actual.soldJobs += 1;
    actual.soldAmount += toNumber(pickFirst(row, SOLD_ALIASES.amount));
    target.set(channel, actual);
  }
  return report.rows.length;
}

function metricTargets(row: CampaignPlanRow | CampaignForecastRow | undefined): CampaignMetricTargets {
  return row ? {
    qualifiedLeads: row.qualifiedLeads,
    bookedJobs: row.bookedJobs,
    spend: row.spend,
    soldAmount: row.soldAmount,
    completedRevenue: row.completedRevenue
  } : { ...EMPTY_TARGETS };
}

function statusFor(pace: number | null, spend: number, soldJobs: number): CampaignPerformanceStatus {
  if (spend >= 500 && soldJobs === 0) return "risk";
  if (pace == null) return "unplanned";
  if (pace >= 1) return "on-track";
  if (pace >= 0.85) return "watch";
  return "off-track";
}

function allocateWholeGoal(goal: number, weights: number[]) {
  const total = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return weights.map(() => 0);
  const exact = weights.map((weight) => goal * Math.max(0, weight) / total);
  const result = exact.map(Math.floor);
  let remaining = goal - result.reduce((sum, value) => sum + value, 0);
  for (const item of exact.map((value, index) => ({ index, part: value - Math.floor(value) })).sort((a, b) => b.part - a.part)) {
    if (remaining <= 0) break;
    result[item.index] = (result[item.index] ?? 0) + 1;
    remaining -= 1;
  }
  return result;
}

function buildNextMonthDraft(
  month: string,
  rows: CampaignPerformanceRow[],
  opportunityGoal: number,
  qualifiedLeadGoal: number,
  targetBookingRate: number,
) {
  const bookedWeights = rows.map((row) => row.actual.bookedJobs || row.effectivePlan.bookedJobs || 0);
  const leadWeights = rows.map((row) => row.actual.qualifiedLeads || row.effectivePlan.qualifiedLeads || 0);
  const booked = allocateWholeGoal(opportunityGoal, bookedWeights);
  const leads = allocateWholeGoal(qualifiedLeadGoal, leadWeights);
  return {
    month: nextMonth(month),
    status: "recommendation" as const,
    opportunityGoal,
    qualifiedLeadGoal,
    targetBookingRate,
    rows: rows.map((row, index) => ({
      channel: row.channel,
      category: row.category,
      budgetType: row.budgetType,
      qualifiedLeads: leads[index] ?? 0,
      bookedJobs: booked[index] ?? 0,
      spend: null,
      soldAmount: null,
      completedRevenue: null,
      notes: "Generated recommendation; approval required."
    })),
    note: "Generated from current channel lead and booking mix. It is not an approved plan."
  };
}

export function buildCampaignPerformanceSnapshot(input: BuildCampaignPerformanceInput): CampaignPerformanceSnapshot {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const actuals = callCenterActuals(input.callCenterValues, input.month, input.cutoff);
  const campaignRows = applyCampaignSummary(actuals, input.campaignSummary);
  const revenueRows = applyRevenueByCampaign(actuals, input.revenueByCampaign);
  const soldRows = applySoldEstimates(actuals, input.soldEstimates);
  const manualCosts = new Map(
    (input.manualCostRows ?? []).map((row) => [normalizeCampaignChannel(row.channel), row]),
  );
  for (const cost of input.manualCostRows ?? []) {
    const channel = normalizeCampaignChannel(cost.channel);
    const actual = actuals.get(channel) ?? { ...EMPTY_ACTUAL };
    actual.spend = Math.max(0, cost.spend);
    actuals.set(channel, actual);
  }
  const plans = new Map(input.planRows.map((row) => [normalizeCampaignChannel(row.channel), row]));
  const forecasts = new Map((input.forecastRows ?? []).map((row) => [normalizeCampaignChannel(row.channel), row]));
  const elapsedCalendarDays = Number(input.cutoff.slice(8, 10));
  const calendarDaysInMonth = daysInMonth(input.month);
  const from = `${input.month}-01`;
  const through = `${input.month}-${String(calendarDaysInMonth).padStart(2, "0")}`;
  const elapsedWorkingDays = countWeekdays(from, input.cutoff);
  const workingDaysInMonth = countWeekdays(from, through);
  const expectedWorkingDayRatio = workingDaysInMonth > 0 ? elapsedWorkingDays / workingDaysInMonth : 0;
  const expectedCalendarDayRatio = elapsedCalendarDays / calendarDaysInMonth;
  const channels = new Set([...actuals.keys(), ...plans.keys(), ...forecasts.keys()]);

  const rows: CampaignPerformanceRow[] = [...channels].map((channel) => {
    const raw = actuals.get(channel) ?? { ...EMPTY_ACTUAL };
    const seed = plans.get(channel);
    const forecastSeed = forecasts.get(channel);
    const inferredCategory = inferCampaignCategory(channel);
    const category = inferredCategory === "other"
      ? forecastSeed?.category ?? seed?.category ?? inferredCategory
      : inferredCategory;
    const budgetType = manualCosts.get(channel)?.budgetType ?? forecastSeed?.budgetType ?? seed?.budgetType ?? inferCampaignBudgetType(channel, category);
    const hasActivity = raw.qualifiedLeads > 0 || raw.bookedJobs > 0 || raw.soldJobs > 0 || raw.completedRevenue > 0;
    const isMissingPaidCost = category === "paid" && hasActivity && raw.spend === 0;
    const actual: CampaignActual = {
      ...raw,
      bookingRate: ratio(raw.bookedJobs, raw.qualifiedLeads),
      costPerLead: isMissingPaidCost ? null : ratio(raw.spend, raw.qualifiedLeads),
      costPerBookedJob: isMissingPaidCost ? null : ratio(raw.spend, raw.bookedJobs),
      roi: raw.spend > 0 ? (raw.completedRevenue - raw.spend) / raw.spend : null,
      roas: ratio(raw.completedRevenue, raw.spend)
    };
    const plan = metricTargets(seed);
    const forecast = forecastSeed ? metricTargets(forecastSeed) : null;
    const effectivePlan = forecast ?? plan;
    const leadAttainment = ratio(actual.qualifiedLeads, effectivePlan.qualifiedLeads);
    const opportunityAttainment = effectivePlan.bookedJobs == null ? null : ratio(actual.bookedJobs, effectivePlan.bookedJobs);
    const pace = opportunityAttainment == null || expectedWorkingDayRatio <= 0 ? null : opportunityAttainment / expectedWorkingDayRatio;
    const budgetPace = effectivePlan.spend == null || expectedCalendarDayRatio <= 0
      ? null
      : ratio(actual.spend, effectivePlan.spend * expectedCalendarDayRatio);
    return {
      channel,
      category,
      budgetType,
      plan,
      forecast,
      effectivePlan,
      forecastEffectiveFrom: forecastSeed?.effectiveFrom ?? null,
      forecastReason: forecastSeed?.reason ?? null,
      actual,
      leadAttainment,
      opportunityAttainment,
      pace,
      budgetPace,
      status: statusFor(pace, actual.spend, actual.soldJobs)
    };
  });
  rows.sort((left, right) => right.actual.bookedJobs - left.actual.bookedJobs || right.actual.qualifiedLeads - left.actual.qualifiedLeads || right.actual.completedRevenue - left.actual.completedRevenue || left.channel.localeCompare(right.channel));

  const activePaidRows = rows.filter((row) => row.category === "paid" && (
    row.actual.qualifiedLeads > 0 || row.actual.bookedJobs > 0 || row.actual.soldJobs > 0 || row.actual.completedRevenue > 0
  ));
  const trackedPaidRows = activePaidRows.filter((row) => row.actual.spend > 0);
  const missingPaidChannels = activePaidRows
    .filter((row) => row.actual.spend === 0)
    .map((row) => row.channel);
  const activePaidLeads = activePaidRows.reduce((sum, row) => sum + row.actual.qualifiedLeads, 0);
  const trackedPaidLeads = trackedPaidRows.reduce((sum, row) => sum + row.actual.qualifiedLeads, 0);
  const spendCoverage: CampaignPerformanceSnapshot["spendCoverage"] = {
    status: activePaidRows.length === 0
      ? "not-applicable"
      : missingPaidChannels.length === 0
        ? "complete"
        : trackedPaidRows.length === 0
          ? "unavailable"
          : "partial",
    activePaidChannels: activePaidRows.length,
    trackedPaidChannels: trackedPaidRows.length,
    missingPaidChannels,
    trackedLeadShare: ratio(trackedPaidLeads, activePaidLeads)
  };

  const totals = rows.reduce<MutableActual>((sum, row) => ({
    calls: sum.calls + row.actual.calls,
    forms: sum.forms + row.actual.forms,
    qualifiedLeads: sum.qualifiedLeads + row.actual.qualifiedLeads,
    bookedJobs: sum.bookedJobs + row.actual.bookedJobs,
    spend: sum.spend + row.actual.spend,
    soldJobs: sum.soldJobs + row.actual.soldJobs,
    soldAmount: sum.soldAmount + row.actual.soldAmount,
    completedRevenue: sum.completedRevenue + row.actual.completedRevenue
  }), { ...EMPTY_ACTUAL });
  const actual: CampaignActual = {
    ...totals,
    bookingRate: ratio(totals.bookedJobs, totals.qualifiedLeads),
    costPerLead: spendCoverage.status === "complete" ? ratio(totals.spend, totals.qualifiedLeads) : null,
    costPerBookedJob: spendCoverage.status === "complete" ? ratio(totals.spend, totals.bookedJobs) : null,
    roi: spendCoverage.status === "complete" && totals.spend > 0 ? (totals.completedRevenue - totals.spend) / totals.spend : null,
    roas: spendCoverage.status === "complete" ? ratio(totals.completedRevenue, totals.spend) : null
  };
  const remainingWorkingDays = Math.max(0, workingDaysInMonth - elapsedWorkingDays);
  const opportunityGap = Math.max(0, input.opportunityGoal - actual.bookedJobs);
  const alerts = rows.flatMap((row) => {
    const result: CampaignPerformanceSnapshot["alerts"] = [];
    if (row.actual.spend >= 500 && row.actual.soldJobs === 0) {
      result.push({ severity: "critical", channel: row.channel, message: `$${row.actual.spend.toLocaleString("en-US", { maximumFractionDigits: 0 })} spent with no sold estimates MTD.` });
    }
    if (row.budgetPace != null && row.budgetPace > 1.15 && (row.pace ?? 0) < 1) {
      result.push({ severity: "critical", channel: row.channel, message: `Spend is ${Math.round(row.budgetPace * 100)}% of pace while opportunities are ${Math.round((row.pace ?? 0) * 100)}%.` });
    }
    if (row.actual.qualifiedLeads >= 5 && row.actual.bookingRate != null && row.actual.bookingRate < input.targetBookingRate) {
      result.push({ severity: "warning", channel: row.channel, message: `Booking rate is ${Math.round(row.actual.bookingRate * 100)}% versus ${Math.round(input.targetBookingRate * 100)}% target.` });
    }
    if (row.status === "unplanned" && row.actual.qualifiedLeads > 0) {
      result.push({ severity: "warning", channel: row.channel, message: `${row.actual.qualifiedLeads} qualified leads have no approved channel target.` });
    }
    if (row.category === "paid" && row.actual.qualifiedLeads > 0 && row.actual.spend === 0) {
      result.push({ severity: "warning", channel: row.channel, message: `Paid channel has lead activity but no tracked spend; ${row.budgetType} cost is missing.` });
    }
    return result;
  }).sort((left, right) => Number(left.severity === "warning") - Number(right.severity === "warning"));

  const capacityAssumptions = input.capacityAssumptions ?? [];
  const planningDays = capacityAssumptions[0]?.planningDays ?? 25;
  const dailyOpportunityCapacity = capacityAssumptions.reduce((sum, row) => sum + row.headcount * row.opportunitiesPerDay, 0);
  const monthlyOpportunityCapacity = capacityAssumptions.reduce((sum, row) => sum + row.headcount * row.opportunitiesPerDay * row.planningDays, 0);
  const forecastRows = input.forecastRows ?? [];
  const forecastEffectiveDates = forecastRows.map((row) => row.effectiveFrom).filter((value): value is string => Boolean(value)).sort();
  const planApproval = input.planApproval ?? { approvalStatus: "required" as const, version: `${input.month}-unapproved` };

  return {
    schemaVersion: 6,
    generatedAt,
    dataStatus: "LIVE",
    period: {
      id: input.month,
      label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${input.month}-01T12:00:00Z`)) + " MTD",
      from,
      to: input.cutoff,
      elapsedCalendarDays,
      calendarDaysInMonth,
      elapsedWorkingDays,
      workingDaysInMonth
    },
    plan: {
      ...planApproval,
      status: input.planStatus,
      originalPlanLocked: true,
      companyRevenueGoal: input.companyRevenueGoal,
      marketingBudgetRate: input.marketingBudgetRate,
      marketingBudgetGoal: input.companyRevenueGoal * input.marketingBudgetRate,
      qualifiedLeadGoal: input.qualifiedLeadGoal,
      opportunityGoal: input.opportunityGoal,
      targetBookingRate: input.targetBookingRate,
      channelBudgetGoalStatus: input.channelBudgetGoalStatus,
      channelLeadGoalMethod: input.channelLeadGoalMethod
    },
    capacity: {
      status: input.capacityStatus ?? "model",
      planningDays,
      dailyOpportunityCapacity,
      monthlyOpportunityCapacity: monthlyOpportunityCapacity || input.opportunityGoal,
      assumptions: capacityAssumptions
    },
    forecast: {
      status: forecastRows.length > 0 ? "active" : "not-set",
      effectiveFrom: forecastEffectiveDates[0] ?? null,
      reason: input.forecastReason ?? forecastRows.find((row) => row.reason)?.reason ?? null,
      changedChannelCount: forecastRows.length
    },
    nextMonthDraft: buildNextMonthDraft(input.month, rows, input.opportunityGoal, input.qualifiedLeadGoal, input.targetBookingRate),
    actual,
    spendCoverage,
    pace: {
      expectedToDateRatio: expectedWorkingDayRatio,
      expectedWorkingDayRatio,
      expectedCalendarDayRatio,
      opportunityPace: ratio(actual.bookedJobs, input.opportunityGoal * expectedWorkingDayRatio),
      qualifiedLeadPace: ratio(actual.qualifiedLeads, input.qualifiedLeadGoal * expectedWorkingDayRatio),
      spendPace: spendCoverage.status === "complete"
        ? ratio(actual.spend, input.companyRevenueGoal * input.marketingBudgetRate * expectedCalendarDayRatio)
        : null,
      projectedOpportunities: expectedWorkingDayRatio > 0 ? actual.bookedJobs / expectedWorkingDayRatio : null,
      opportunityGap,
      requiredOpportunitiesPerRemainingDay: remainingWorkingDays > 0 ? opportunityGap / remainingWorkingDays : null
    },
    alerts,
    rows,
    sources: [
      { name: "Google Call Center Sheet", role: "Calls, forms, qualified leads, booked jobs", status: "connected", refreshedAt: generatedAt, rowCount: Math.max(0, input.callCenterValues.length - 1) },
      { name: "ServiceTitan Campaign Summary", role: "Tracked spend", reportId: input.sourceReportIds.campaignSummary, status: "connected", refreshedAt: generatedAt, rowCount: campaignRows },
      { name: "ServiceTitan Sold Estimates", role: "Sold jobs and sold amount", reportId: input.sourceReportIds.soldEstimates, status: "connected", refreshedAt: generatedAt, rowCount: soldRows },
      { name: "ServiceTitan Revenue By Campaign", role: "Completed revenue", reportId: input.sourceReportIds.revenueByCampaign, status: "connected", refreshedAt: generatedAt, rowCount: revenueRows },
      { name: "Google Campaign Plan", role: "Approved channel plan, capacity and forecast", status: planApproval.approvalStatus === "approved" && (input.connectedPlanRowCount ?? input.planRows.length) > 0 ? "connected" : "blocked", refreshedAt: generatedAt, rowCount: input.connectedPlanRowCount ?? input.planRows.length },
      { name: "Google Campaign Costs", role: "Latest MTD paid-channel spend overrides", status: (input.connectedCostRowCount ?? input.manualCostRows?.length ?? 0) > 0 ? "connected" : "blocked", refreshedAt: generatedAt, rowCount: input.connectedCostRowCount ?? input.manualCostRows?.length ?? 0 }
    ],
    dataNotes: [
      "Google Sheet rows after the MTD cutoff are excluded.",
      "ServiceTitan campaign names are normalized into Paid channels, Separate spend, Organic / Online Listings, and Automation groups.",
      "Lead and opportunity pace uses weekdays; spend pace uses calendar days.",
      "Tracked spend includes ServiceTitan costs plus the latest MTD manual cost override for each channel.",
      spendCoverage.status === "complete"
        ? "Cost coverage is complete for all active paid channels."
        : `Cost metrics are withheld because spend is missing for: ${missingPaidChannels.join(", ") || "active paid channels"}.`,
      "The original approved plan remains locked; mid-month changes are shown as forecast revisions.",
      input.channelLeadGoalMethod
    ]
  };
}
