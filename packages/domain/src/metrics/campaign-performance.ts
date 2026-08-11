import { pickFirst, resolveTabularReport, toNumber } from "../shared/report";

export type CampaignPerformanceStatus = "on-track" | "watch" | "off-track" | "risk" | "unplanned";

export type CampaignPlanRow = {
  channel: string;
  qualifiedLeads: number;
  bookedJobs: number | null;
  spend: number | null;
  soldAmount: number | null;
  completedRevenue: number | null;
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
    channelLeadGoalMethod: string;
  };
  actual: CampaignActual;
  pace: {
    expectedToDateRatio: number;
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

export type CampaignPerformanceSource = {
  name: string;
  role: string;
  reportId?: string;
  status: "connected" | "blocked" | "stale";
  refreshedAt: string;
  rowCount?: number;
};

type CampaignActual = {
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
  roi?: number | null;
};

type CampaignPerformanceRow = {
  channel: string;
  plan: Omit<CampaignPlanRow, "channel">;
  actual: CampaignActual;
  leadAttainment: number | null;
  opportunityAttainment: number | null;
  pace: number | null;
  status: CampaignPerformanceStatus;
};

type BuildCampaignPerformanceInput = {
  month: string;
  cutoff: string;
  generatedAt?: string;
  callCenterValues: unknown[][];
  campaignSummary: unknown;
  soldEstimates: unknown;
  revenueByCampaign: unknown;
  planRows: CampaignPlanRow[];
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

type MutableActual = Omit<CampaignActual, "bookingRate" | "costPerLead" | "roi">;

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

function roi(revenue: number, spend: number) {
  return spend > 0 ? (revenue - spend) / spend : null;
}

function daysInMonth(month: string) {
  const [year = 0, monthNumber = 0] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function normalizeCampaignChannel(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) return "Miscellaneous";

  const rules: Array<[string, string[]]> = [
    ["Yelp", ["yelp"]],
    ["Google LSA", ["google local services", "google lsa", "lsa"]],
    ["Website", ["direct web traffic", "google organic", "website"]],
    ["GBP San Jose", ["gbp san jose", "google business"]],
    ["Google Ads", ["google ads", "maxconv", "pmax", "irbis |"]],
    ["Facebook", ["facebook", "paid social", "social"]],
    ["Hatch Campaigns", ["hatch"]],
    ["Workfuel", ["workfuel", "work fuel"]],
    ["Carrier", ["carrier"]],
    ["669-COOLING", ["669-cooling", "669 cooling"]],
    ["Mail Shark", ["mail shark", "direct mail"]],
    ["Scheduling Pro", ["scheduling pro"]],
    ["Home Care Plan", ["home care plan"]],
    ["Existing Customers", ["existing customer"]],
    ["Now Operator", ["now operator"]],
    ["Miscellaneous", ["miscellaneous", "recall", "warranty"]]
  ];

  return rules.find(([, markers]) => markers.some((marker) => normalized.includes(marker)))?.[0] ?? "Other";
}

function parseSheetDateKey(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000).toISOString().slice(0, 10);
  }
  const raw = String(value ?? "").trim();
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  }
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    return `${us[3]}-${String(us[1]).padStart(2, "0")}-${String(us[2]).padStart(2, "0")}`;
  }
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
    if (!dateKey) continue;
    if (!dateKey.startsWith(month) || dateKey > cutoff) continue;
    const channel = normalizeCampaignChannel(row[channelIndex]);
    if (channel === "Other") continue;
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
    if (channel === "Other") continue;
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
    if (channel === "Other") continue;
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
    if (channel === "Other") continue;
    const actual = target.get(channel) ?? { ...EMPTY_ACTUAL };
    actual.soldJobs += 1;
    actual.soldAmount += toNumber(pickFirst(row, SOLD_ALIASES.amount));
    target.set(channel, actual);
  }
  return report.rows.length;
}

function statusFor(pace: number | null, spend: number, soldJobs: number): CampaignPerformanceStatus {
  if (spend >= 500 && soldJobs === 0) return "risk";
  if (pace == null) return "unplanned";
  if (pace >= 1) return "on-track";
  if (pace >= 0.85) return "watch";
  return "off-track";
}

export function buildCampaignPerformanceSnapshot(input: BuildCampaignPerformanceInput): CampaignPerformanceSnapshot {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const actuals = callCenterActuals(input.callCenterValues, input.month, input.cutoff);
  const campaignRows = applyCampaignSummary(actuals, input.campaignSummary);
  const revenueRows = applyRevenueByCampaign(actuals, input.revenueByCampaign);
  const soldRows = applySoldEstimates(actuals, input.soldEstimates);
  const plans = new Map(input.planRows.map((row) => [row.channel, row]));
  const elapsedCalendarDays = Number(input.cutoff.slice(8, 10));
  const calendarDaysInMonth = daysInMonth(input.month);
  const expectedToDateRatio = elapsedCalendarDays / calendarDaysInMonth;
  const channels = new Set([...actuals.keys(), ...plans.keys()]);

  const rows: CampaignPerformanceRow[] = [...channels].map((channel) => {
    const raw = actuals.get(channel) ?? { ...EMPTY_ACTUAL };
    const actual: CampaignActual = {
      ...raw,
      bookingRate: ratio(raw.bookedJobs, raw.qualifiedLeads),
      costPerLead: ratio(raw.spend, raw.qualifiedLeads),
      roi: roi(raw.completedRevenue, raw.spend)
    };
    const seed = plans.get(channel);
    const plan = {
      qualifiedLeads: seed?.qualifiedLeads ?? 0,
      bookedJobs: seed?.bookedJobs ?? null,
      spend: seed?.spend ?? null,
      soldAmount: seed?.soldAmount ?? null,
      completedRevenue: seed?.completedRevenue ?? null
    };
    const leadAttainment = ratio(actual.qualifiedLeads, plan.qualifiedLeads);
    const opportunityAttainment = plan.bookedJobs == null
      ? null
      : ratio(actual.bookedJobs, plan.bookedJobs);
    const pace = opportunityAttainment == null
      ? null
      : opportunityAttainment / expectedToDateRatio;
    return {
      channel,
      plan,
      actual,
      leadAttainment,
      opportunityAttainment,
      pace,
      status: statusFor(pace, actual.spend, actual.soldJobs)
    };
  });
  rows.sort((left, right) =>
    right.actual.bookedJobs - left.actual.bookedJobs ||
    right.actual.qualifiedLeads - left.actual.qualifiedLeads ||
    right.actual.completedRevenue - left.actual.completedRevenue ||
    left.channel.localeCompare(right.channel),
  );

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
    costPerLead: ratio(totals.spend, totals.qualifiedLeads),
    roi: roi(totals.completedRevenue, totals.spend)
  };
  const remainingCalendarDays = Math.max(0, calendarDaysInMonth - elapsedCalendarDays);
  const opportunityGap = Math.max(0, input.opportunityGoal - actual.bookedJobs);
  const alerts = rows.flatMap((row) => {
    const result: CampaignPerformanceSnapshot["alerts"] = [];
    if (row.actual.spend >= 500 && row.actual.soldJobs === 0) {
      result.push({ severity: "critical", channel: row.channel, message: `$${row.actual.spend.toLocaleString("en-US", { maximumFractionDigits: 0 })} spent with no sold estimates MTD.` });
    }
    if (row.actual.qualifiedLeads >= 5 && row.actual.bookingRate != null && row.actual.bookingRate < 0.5) {
      result.push({ severity: "warning", channel: row.channel, message: `Booking rate is ${Math.round(row.actual.bookingRate * 100)}% on ${row.actual.qualifiedLeads} qualified leads.` });
    }
    return result;
  }).sort((left, right) => Number(left.severity === "warning") - Number(right.severity === "warning")).slice(0, 4);

  return {
    schemaVersion: 2,
    generatedAt,
    dataStatus: "LIVE",
    period: {
      id: input.month,
      label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${input.month}-01T12:00:00Z`)) + " MTD",
      from: `${input.month}-01`,
      to: input.cutoff,
      elapsedCalendarDays,
      calendarDaysInMonth
    },
    plan: {
      status: input.planStatus,
      companyRevenueGoal: input.companyRevenueGoal,
      marketingBudgetRate: input.marketingBudgetRate,
      marketingBudgetGoal: input.companyRevenueGoal * input.marketingBudgetRate,
      qualifiedLeadGoal: input.qualifiedLeadGoal,
      opportunityGoal: input.opportunityGoal,
      targetBookingRate: input.targetBookingRate,
      channelBudgetGoalStatus: input.channelBudgetGoalStatus,
      channelLeadGoalMethod: input.channelLeadGoalMethod
    },
    actual,
    pace: {
      expectedToDateRatio,
      opportunityPace: ratio(actual.bookedJobs, input.opportunityGoal * expectedToDateRatio),
      qualifiedLeadPace: ratio(actual.qualifiedLeads, input.qualifiedLeadGoal * expectedToDateRatio),
      spendPace: ratio(actual.spend, input.companyRevenueGoal * input.marketingBudgetRate * expectedToDateRatio),
      projectedOpportunities: expectedToDateRatio > 0 ? actual.bookedJobs / expectedToDateRatio : null,
      opportunityGap,
      requiredOpportunitiesPerRemainingDay: remainingCalendarDays > 0
        ? opportunityGap / remainingCalendarDays
        : null
    },
    alerts,
    rows,
    sources: [
      { name: "Google Call Center Sheet", role: "Calls, forms, qualified leads, booked jobs", status: "connected", refreshedAt: generatedAt, rowCount: Math.max(0, input.callCenterValues.length - 1) },
      { name: "ServiceTitan Campaign Summary", role: "Tracked spend", reportId: input.sourceReportIds.campaignSummary, status: "connected", refreshedAt: generatedAt, rowCount: campaignRows },
      { name: "ServiceTitan Sold Estimates", role: "Sold jobs and sold amount", reportId: input.sourceReportIds.soldEstimates, status: "connected", refreshedAt: generatedAt, rowCount: soldRows },
      { name: "ServiceTitan Revenue By Campaign", role: "Completed revenue", reportId: input.sourceReportIds.revenueByCampaign, status: "connected", refreshedAt: generatedAt, rowCount: revenueRows }
    ],
    dataNotes: [
      "Google Sheet rows after the MTD cutoff are excluded.",
      "ServiceTitan campaign names are normalized into executive channels.",
      "Tracked spend only includes costs available in ServiceTitan.",
      input.channelLeadGoalMethod
    ]
  };
}
