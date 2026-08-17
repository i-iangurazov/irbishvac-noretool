import { getConfig } from "@irbis/config";
import { DashboardFamily, Prisma, RunStatus, prisma } from "@irbis/db";
import {
  buildCampaignPerformanceSnapshot,
  inferCampaignBudgetType,
  inferCampaignCategory,
  normalizeCampaignChannel,
  type CampaignCapacityAssumption,
  type CampaignForecastRow,
  type CampaignManualCostRow,
  type CampaignPlanApproval,
  type CampaignPlanRow
} from "@irbis/domain";
import {
  GoogleSheetsClient,
  ServiceTitanClient,
  type ReportParameter
} from "@irbis/integrations";
import { createLogger, getDateParts } from "@irbis/utils";

const logger = createLogger("campaign-performance-refresh");
const SCOPE_PREFIX = "campaign-performance:";

const AUGUST_2026_BASELINE: CampaignPlanRow[] = [
  ["Yelp", 599, 239, 27243.91, 389198.75],
  ["Workfuel", 29, 14, 2782.61, 39751.52],
  ["Website", 78, 77, 28499.70, 407138.61],
  ["Google Ads", 80, 69, 26579.84, 379712.05],
  ["Facebook Ads", 53, 21, 5957.11, 85101.62],
  ["Radio", 0, 0, null, null],
  ["GBP San Jose", 60, 58, 10645.90, 152084.25],
  ["Miscellaneous", 81, 60, 219.16, 3130.79],
  ["Google Local Services", 19, 17, 259.57, 3708.18],
  ["Home Care", 21, 21, null, null],
  ["Now Operator", 0, null, null, null],
  ["669-COOLING", 29, 26, 12869.77, 183853.91],
  ["Scheduling Pro", 35, 33, null, null],
  ["3rd Party Websites", 13, 12, 408.83, 5840.46],
  ["Hatch Campaigns", 20, 20, 3041.42, 43448.84],
  ["Direct Mail", 8, 8, 15.80, 225.69],
  ["Existing Customers", 0, null, 21476.37, 306805.32]
].map(([channel, qualifiedLeads, bookedJobs, spend, completedRevenue]) => ({
  channel: String(channel),
  category: inferCampaignCategory(String(channel)),
  budgetType: inferCampaignBudgetType(String(channel)),
  qualifiedLeads: Number(qualifiedLeads),
  bookedJobs: bookedJobs == null ? null : Number(bookedJobs),
  spend: spend == null ? null : Number(spend),
  soldAmount: null,
  completedRevenue: completedRevenue == null ? null : Number(completedRevenue)
}));

const DEFAULT_CAPACITY_ASSUMPTIONS: CampaignCapacityAssumption[] = [
  { team: "HVAC Service", headcount: 5, opportunitiesPerDay: 3, planningDays: 25, notes: "Tim capacity model" },
  { team: "HVAC Maintenance", headcount: 2, opportunitiesPerDay: 3, planningDays: 25, notes: "Tim capacity model" },
  { team: "Commercial Service", headcount: 1, opportunitiesPerDay: 3, planningDays: 25, notes: "Tim capacity model" },
  { team: "Plumbing Service", headcount: 3, opportunitiesPerDay: 3, planningDays: 25, notes: "Tim capacity model" },
  { team: "Comfort Advisors", headcount: 3, opportunitiesPerDay: 4, planningDays: 25, notes: "Tim capacity model" }
];

function allocateWholeGoal(goal: number, weights: number[]) {
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (totalWeight <= 0) return weights.map(() => 0);
  const exact = weights.map((weight) => goal * weight / totalWeight);
  const allocated = exact.map(Math.floor);
  let remainder = goal - allocated.reduce((sum, value) => sum + value, 0);
  const priority = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (const row of priority) {
    if (remainder <= 0) break;
    allocated[row.index] = (allocated[row.index] ?? 0) + 1;
    remainder -= 1;
  }
  return allocated;
}

function buildAugustModelPlan(opportunityGoal: number, targetBookingRate: number) {
  const qualifiedLeadGoal = Math.round(opportunityGoal / targetBookingRate);
  const bookedGoals = allocateWholeGoal(
    opportunityGoal,
    AUGUST_2026_BASELINE.map((row) => row.bookedJobs ?? 0),
  );
  const leadGoals = allocateWholeGoal(
    qualifiedLeadGoal,
    AUGUST_2026_BASELINE.map((row) => row.qualifiedLeads),
  );
  return AUGUST_2026_BASELINE.map((row, index) => ({
    ...row,
    qualifiedLeads: leadGoals[index] ?? 0,
    bookedJobs: bookedGoals[index] ?? 0
  }));
}

type ReportDefinition = {
  name?: string;
  parameters?: Array<{
    name?: string;
    label?: string;
    dataType?: string;
    isRequired?: boolean;
    acceptValues?: { values?: unknown[][] };
  }>;
};

function validateMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Campaign refresh month must use YYYY-MM format");
  }
  const monthNumber = Number(month.slice(5, 7));
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error("Campaign refresh month is invalid");
  }
}

function monthEnd(month: string) {
  const [year = 0, monthNumber = 0] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

function cutoffForMonth(month: string, timezone: string) {
  const current = getDateParts(new Date(), timezone);
  const currentMonth = `${current.year}-${String(current.month).padStart(2, "0")}`;
  if (month > currentMonth) {
    throw new Error("Future campaign months cannot be refreshed");
  }
  return month === currentMonth
    ? `${currentMonth}-${String(current.day).padStart(2, "0")}`
    : monthEnd(month);
}

function buildReportParameters(definition: ReportDefinition, from: string, to: string) {
  const parameters: ReportParameter[] = [];
  for (const parameter of definition.parameters ?? []) {
    if (!parameter.isRequired || !parameter.name) continue;
    const normalized = `${parameter.name} ${parameter.label ?? ""}`.toLowerCase();
    if (parameter.dataType === "Date") {
      const isEnd = ["_to", " to", " end", "through", "until"].some((marker) => normalized.includes(marker));
      parameters.push({ name: parameter.name, value: isEnd ? to : from });
      continue;
    }
    if (parameter.dataType === "Boolean") {
      parameters.push({ name: parameter.name, value: false });
      continue;
    }
    const accepted = parameter.acceptValues?.values?.[0]?.[0];
    if (
      typeof accepted === "string" ||
      typeof accepted === "number" ||
      typeof accepted === "boolean" ||
      (Array.isArray(accepted) && accepted.every((value) => typeof value === "number"))
    ) {
      parameters.push({ name: parameter.name, value: accepted });
      continue;
    }
    throw new Error(`Cannot resolve required ServiceTitan parameter ${parameter.name}`);
  }
  return parameters;
}

function planForMonth(month: string, opportunityGoal: number, targetBookingRate: number) {
  if (month === "2026-08") {
    return {
      rows: buildAugustModelPlan(opportunityGoal, targetBookingRate),
      status: "DRAFT MODEL - APPROVAL REQUIRED",
      approval: {
        approvalStatus: "draft",
        version: `${month}-capacity-model`
      } satisfies CampaignPlanApproval,
      leadMethod: `${opportunityGoal.toLocaleString("en-US")} booked-opportunity capacity model allocated by July channel mix; channel targets await Emil and Tim approval.`,
      budgetMethod: "Draft allocation by July completed-revenue share; not an approved budget"
    };
  }
  return {
    rows: [] as CampaignPlanRow[],
    status: "PLAN REQUIRED",
    approval: {
      approvalStatus: "required",
      version: `${month}-missing`
    } satisfies CampaignPlanApproval,
    leadMethod: "No approved channel plan is connected for this month.",
    budgetMethod: "No approved channel budget is connected for this month."
  };
}

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function columnIndex(headers: unknown[], aliases: string[], fallback = -1) {
  const candidates = aliases.map(normalizeHeader);
  const index = headers.findIndex((value) => candidates.includes(normalizeHeader(value)));
  return index >= 0 ? index : fallback;
}

function optionalNumber(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function monthMatches(value: unknown, month: string) {
  const normalized = String(value ?? "").trim();
  return normalized === "" || normalized === month || normalized.startsWith(`${month}-`);
}

function parseConnectedPlan(values: unknown[][] | undefined, month: string) {
  const empty = {
    rows: [] as CampaignPlanRow[],
    approval: null as CampaignPlanApproval | null
  };
  if (!values || values.length < 2) return empty;
  const headers = values[0] ?? [];
  const monthIndex = columnIndex(headers, ["Month"]);
  const channelIndex = columnIndex(headers, ["Channel", "Campaign"], 0);
  const categoryIndex = columnIndex(headers, ["Category"]);
  const leadIndex = columnIndex(headers, ["Qualified Lead Goal", "Qualified Leads", "Lead Goal"], monthIndex >= 0 ? 3 : 1);
  const bookedIndex = columnIndex(headers, ["Booked Opportunity Goal", "Booked Jobs", "Opportunity Goal"], monthIndex >= 0 ? 4 : 2);
  const spendIndex = columnIndex(headers, ["Approved Budget", "Budget", "Spend"], monthIndex >= 0 ? 5 : 3);
  const soldIndex = columnIndex(headers, ["Sold Amount Goal", "Sold Amount"], monthIndex >= 0 ? 6 : 4);
  const revenueIndex = columnIndex(headers, ["Revenue Goal", "Completed Revenue"], monthIndex >= 0 ? 7 : 5);
  const budgetTypeIndex = columnIndex(headers, ["Budget Type"]);
  const approvedByIndex = columnIndex(headers, ["Approved By"]);
  const approvedAtIndex = columnIndex(headers, ["Approved At"]);
  const statusIndex = columnIndex(headers, ["Status", "Approval Status"]);
  const notesIndex = columnIndex(headers, ["Notes"]);
  const latestByChannel = new Map<string, {
    plan: CampaignPlanRow;
    status: string;
    approvedBy: string | null;
    approvedAt: string | null;
  }>();
  for (const row of values.slice(1)) {
    if (monthIndex >= 0 && !monthMatches(row[monthIndex], month)) continue;
    const channel = normalizeCampaignChannel(row[channelIndex]);
    const qualifiedLeads = Number(row[leadIndex]);
    const bookedJobs = optionalNumber(row[bookedIndex]);
    if (
      channel === "Other" ||
      !Number.isFinite(qualifiedLeads) ||
      qualifiedLeads < 0 ||
      bookedJobs == null ||
      bookedJobs < 0
    ) continue;
    const inferredCategory = inferCampaignCategory(channel);
    const categoryValue = String(categoryIndex >= 0 ? row[categoryIndex] ?? "" : "").trim().toLowerCase();
    const category: NonNullable<CampaignPlanRow["category"]> = ["paid", "separate-spend", "organic", "automation", "partner", "retention", "other"].includes(categoryValue)
      ? categoryValue as NonNullable<CampaignPlanRow["category"]>
      : inferredCategory;
    const budgetTypeValue = String(budgetTypeIndex >= 0 ? row[budgetTypeIndex] ?? "" : "").trim().toLowerCase();
    const budgetType: NonNullable<CampaignPlanRow["budgetType"]> = ["platform", "manual", "prepaid", "none"].includes(budgetTypeValue)
      ? budgetTypeValue as NonNullable<CampaignPlanRow["budgetType"]>
      : inferCampaignBudgetType(channel, category);
    latestByChannel.set(channel, {
      plan: {
        channel,
        category,
        budgetType,
        qualifiedLeads,
        bookedJobs,
        spend: optionalNumber(row[spendIndex]),
        soldAmount: optionalNumber(row[soldIndex]),
        completedRevenue: optionalNumber(row[revenueIndex]),
        notes: notesIndex >= 0 ? String(row[notesIndex] ?? "").trim() || null : null
      },
      status: String(statusIndex >= 0 ? row[statusIndex] ?? "" : "").trim().toLowerCase(),
      approvedBy: approvedByIndex >= 0 ? String(row[approvedByIndex] ?? "").trim() || null : null,
      approvedAt: approvedAtIndex >= 0 ? String(row[approvedAtIndex] ?? "").trim() || null : null
    });
  }
  const entries = [...latestByChannel.values()];
  if (entries.length === 0) return empty;
  const approvalStatus = entries.every((entry) => entry.status === "approved") ? "approved" : "draft";
  const approvalEntry = [...entries].reverse().find((entry) => entry.status === "approved") ?? entries.at(-1)!;
  return {
    rows: entries.map((entry) => entry.plan),
    approval: {
      approvalStatus,
      version: `${month}-${approvalStatus}`,
      approvedBy: approvalEntry.approvedBy,
      approvedAt: approvalEntry.approvedAt
    } satisfies CampaignPlanApproval
  };
}

function parseCapacityPlan(values: unknown[][] | undefined, month: string) {
  if (!values || values.length < 2) return [];
  const headers = values[0] ?? [];
  const monthIndex = columnIndex(headers, ["Month"], 0);
  const teamIndex = columnIndex(headers, ["Team", "Department"], 1);
  const headcountIndex = columnIndex(headers, ["Headcount", "Technicians"], 2);
  const perDayIndex = columnIndex(headers, ["Opportunities Day", "Opportunities Per Day", "Opps Day"], 3);
  const daysIndex = columnIndex(headers, ["Working Days", "Planning Days"], 4);
  const effectiveIndex = columnIndex(headers, ["Effective From"], 5);
  const notesIndex = columnIndex(headers, ["Notes"], 6);
  const latestByTeam = new Map<string, CampaignCapacityAssumption>();
  for (const row of values.slice(1)) {
    if (!monthMatches(row[monthIndex], month)) continue;
    const headcount = optionalNumber(row[headcountIndex]);
    const opportunitiesPerDay = optionalNumber(row[perDayIndex]);
    const planningDays = optionalNumber(row[daysIndex]);
    const team = String(row[teamIndex] ?? "").trim();
    if (!team || headcount == null || opportunitiesPerDay == null || planningDays == null) continue;
    latestByTeam.set(team, {
      team,
      headcount,
      opportunitiesPerDay,
      planningDays,
      effectiveFrom: effectiveIndex >= 0 ? String(row[effectiveIndex] ?? "").trim() || null : null,
      notes: notesIndex >= 0 ? String(row[notesIndex] ?? "").trim() || null : null
    } satisfies CampaignCapacityAssumption);
  }
  return [...latestByTeam.values()];
}

function parseForecast(values: unknown[][] | undefined, month: string) {
  if (!values || values.length < 2) return [];
  const headers = values[0] ?? [];
  const monthIndex = columnIndex(headers, ["Month"], 0);
  const channelIndex = columnIndex(headers, ["Channel", "Campaign"], 1);
  const leadsIndex = columnIndex(headers, ["Qualified Lead Forecast", "Qualified Leads"], 2);
  const bookedIndex = columnIndex(headers, ["Booked Opportunity Forecast", "Booked Forecast"], 3);
  const budgetIndex = columnIndex(headers, ["Budget Forecast", "Spend Forecast"], 4);
  const soldIndex = columnIndex(headers, ["Sold Amount Forecast"], 5);
  const revenueIndex = columnIndex(headers, ["Revenue Forecast"], 6);
  const effectiveIndex = columnIndex(headers, ["Effective From"], 7);
  const reasonIndex = columnIndex(headers, ["Reason", "Revision Reason"], 8);
  const latestByChannel = new Map<string, CampaignForecastRow>();
  for (const row of values.slice(1)) {
    if (!monthMatches(row[monthIndex], month)) continue;
    const channel = normalizeCampaignChannel(row[channelIndex]);
    const qualifiedLeads = optionalNumber(row[leadsIndex]);
    const bookedJobs = optionalNumber(row[bookedIndex]);
    if (channel === "Other" || qualifiedLeads == null || bookedJobs == null) continue;
    const category = inferCampaignCategory(channel);
    latestByChannel.set(channel, {
      channel,
      category,
      budgetType: inferCampaignBudgetType(channel, category),
      qualifiedLeads,
      bookedJobs,
      spend: optionalNumber(row[budgetIndex]),
      soldAmount: optionalNumber(row[soldIndex]),
      completedRevenue: optionalNumber(row[revenueIndex]),
      effectiveFrom: effectiveIndex >= 0 ? String(row[effectiveIndex] ?? "").trim() || null : null,
      reason: reasonIndex >= 0 ? String(row[reasonIndex] ?? "").trim() || null : null
    } satisfies CampaignForecastRow);
  }
  return [...latestByChannel.values()];
}

function parseManualCosts(values: unknown[][] | undefined, month: string) {
  if (!values || values.length < 2) return [];
  const headers = values[0] ?? [];
  const monthIndex = columnIndex(headers, ["Month"], 0);
  const channelIndex = columnIndex(headers, ["Channel", "Campaign"], 1);
  const spendIndex = columnIndex(headers, ["MTD Spend", "Spend", "Actual Spend"], 2);
  const budgetTypeIndex = columnIndex(headers, ["Budget Type", "Cost Type"], 3);
  const effectiveIndex = columnIndex(headers, ["Effective From", "As Of"], 4);
  const notesIndex = columnIndex(headers, ["Notes"], 5);
  const latestByChannel = new Map<string, CampaignManualCostRow>();

  for (const row of values.slice(1)) {
    if (!monthMatches(row[monthIndex], month)) continue;
    const channel = normalizeCampaignChannel(row[channelIndex]);
    const spend = optionalNumber(row[spendIndex]);
    if (channel === "Other" || spend == null || spend < 0) continue;
    const inferred = inferCampaignBudgetType(channel);
    const rawBudgetType = String(row[budgetTypeIndex] ?? "").trim().toLowerCase();
    const budgetType = ["platform", "manual", "prepaid"].includes(rawBudgetType)
      ? rawBudgetType as "platform" | "manual" | "prepaid"
      : inferred === "none" ? "manual" : inferred;
    latestByChannel.set(channel, {
      channel,
      spend,
      budgetType,
      effectiveFrom: effectiveIndex >= 0 ? String(row[effectiveIndex] ?? "").trim() || null : null,
      notes: notesIndex >= 0 ? String(row[notesIndex] ?? "").trim() || null : null
    });
  }

  return [...latestByChannel.values()];
}

export class CampaignPerformanceRefreshRunner {
  private readonly config = getConfig();
  private readonly sheets = new GoogleSheetsClient();
  private readonly serviceTitan = new ServiceTitanClient();

  getMissingConfiguration() {
    return [...this.sheets.getMissingConfiguration(), ...this.serviceTitan.getMissingConfiguration()];
  }

  async refresh(month: string, correlationId: string) {
    validateMonth(month);
    const missing = this.getMissingConfiguration();
    if (missing.length > 0) {
      throw new Error(`Campaign performance refresh is not configured: ${missing.join(", ")}`);
    }

    const cutoff = cutoffForMonth(month, this.config.app.timezone);
    const from = `${month}-01`;
    const scopeKey = `${SCOPE_PREFIX}${month}`;
    const requestParams = {
      month,
      from,
      to: cutoff,
      spreadsheetId: this.config.campaignPerformance.google.spreadsheetId,
      reports: {
        campaignSummary: this.config.serviceTitan.reports.campaigns.reportId,
        soldEstimates: this.config.serviceTitan.reports.campaignSoldEstimates.reportId,
        revenueByCampaign: this.config.serviceTitan.reports.campaignRevenue.reportId
      }
    };
    const businessDateFrom = new Date(`${from}T00:00:00.000Z`);
    const businessDateTo = new Date(`${cutoff}T00:00:00.000Z`);
    const jobRun = await prisma.jobRun.create({
      data: {
        family: DashboardFamily.CAMPAIGNS,
        queueName: "retool-replacement-refresh",
        jobName: "refresh-campaign-performance",
        status: RunStatus.RUNNING,
        correlationId,
        attempts: 1,
        payload: requestParams,
        startedAt: new Date()
      }
    });
    const ingestionRun = await prisma.ingestionRun.upsert({
      where: { idempotencyKey: scopeKey },
      create: {
        family: DashboardFamily.CAMPAIGNS,
        status: RunStatus.RUNNING,
        requestHash: scopeKey,
        idempotencyKey: scopeKey,
        businessDateFrom,
        businessDateTo,
        requestParams,
        startedAt: new Date(),
        jobRunId: jobRun.id
      },
      update: {
        status: RunStatus.RUNNING,
        businessDateFrom,
        businessDateTo,
        requestParams,
        responseMeta: Prisma.DbNull,
        errorJson: Prisma.DbNull,
        startedAt: new Date(),
        finishedAt: null,
        jobRunId: jobRun.id
      }
    });

    try {
      const callCenter = await this.sheets.getValues("Master Sheet!A:N");
      const [connectedPlanSheet, capacityPlanSheet, forecastSheet, costSheet] = await Promise.all([
        this.sheets.getOptionalValues("Campaign Plan!A:O"),
        this.sheets.getOptionalValues("Capacity Plan!A:G"),
        this.sheets.getOptionalValues("Campaign Forecast!A:J"),
        this.sheets.getOptionalValues("Campaign Costs!A:H")
      ]);
      const reportSpecs = [
        this.config.serviceTitan.reports.campaigns,
        this.config.serviceTitan.reports.campaignSoldEstimates,
        this.config.serviceTitan.reports.campaignRevenue
      ] as const;
      const reportPayloads: unknown[] = [];

      for (const report of reportSpecs) {
        const definitionResult = await this.serviceTitan.fetchReportDefinition({
          family: "campaigns",
          category: report.category,
          reportId: report.reportId,
          correlationId
        });
        const parameters = buildReportParameters(definitionResult.payload as ReportDefinition, from, cutoff);
        const result = await this.serviceTitan.fetchPaginatedReport({
          family: "campaigns",
          category: report.category,
          reportId: report.reportId,
          parameters,
          correlationId
        });
        reportPayloads.push(result.payload);
      }

      const connectedCapacityRows = parseCapacityPlan(capacityPlanSheet?.values, month);
      const capacityRows = connectedCapacityRows.length > 0
        ? connectedCapacityRows
        : DEFAULT_CAPACITY_ASSUMPTIONS;
      const capacityOpportunityGoal = capacityRows.reduce(
        (sum, row) => sum + row.headcount * row.opportunitiesPerDay * row.planningDays,
        0,
      );
      const modelOpportunityGoal = capacityOpportunityGoal || this.config.campaignPerformance.opportunityGoal;
      const fallbackPlan = planForMonth(
        month,
        modelOpportunityGoal,
        this.config.campaignPerformance.targetBookingRate,
      );
      const connectedPlan = parseConnectedPlan(connectedPlanSheet?.values, month);
      const forecastRows = parseForecast(forecastSheet?.values, month);
      const manualCostRows = parseManualCosts(costSheet?.values, month);
      const plan = connectedPlan.rows.length > 0
        ? {
            rows: connectedPlan.rows,
            status: connectedPlan.approval?.approvalStatus === "approved" ? "APPROVED PLAN" : "CONNECTED DRAFT",
            approval: connectedPlan.approval ?? { approvalStatus: "draft", version: `${month}-draft` } satisfies CampaignPlanApproval,
            leadMethod: "Channel goals read from Google Sheet Campaign Plan; only rows marked Approved are treated as approved.",
            budgetMethod: "Channel budgets read from Google Sheet Campaign Plan."
          }
        : fallbackPlan;
      const effectivePlanRows = plan.rows.map((row) => {
        const revision = forecastRows.find((candidate) => candidate.channel === row.channel);
        return revision ?? row;
      });
      for (const revision of forecastRows) {
        if (!effectivePlanRows.some((row) => row.channel === revision.channel)) effectivePlanRows.push(revision);
      }
      const connectedLeadGoal = effectivePlanRows.reduce((sum, row) => sum + row.qualifiedLeads, 0);
      const connectedOpportunityGoal = effectivePlanRows.reduce((sum, row) => sum + (row.bookedJobs ?? 0), 0);
      const qualifiedLeadGoal = connectedPlan.rows.length > 0
        ? connectedLeadGoal
        : Math.round(
            modelOpportunityGoal /
            this.config.campaignPerformance.targetBookingRate,
          );
      const opportunityGoal = connectedPlan.rows.length > 0
        ? connectedOpportunityGoal
        : modelOpportunityGoal;
      const targetBookingRate = qualifiedLeadGoal > 0
        ? opportunityGoal / qualifiedLeadGoal
        : this.config.campaignPerformance.targetBookingRate;
      const generatedAt = new Date().toISOString();
      const snapshot = buildCampaignPerformanceSnapshot({
        month,
        cutoff,
        generatedAt,
        callCenterValues: callCenter.values ?? [],
        campaignSummary: reportPayloads[0] ?? {},
        soldEstimates: reportPayloads[1] ?? {},
        revenueByCampaign: reportPayloads[2] ?? {},
        planRows: plan.rows,
        forecastRows,
        manualCostRows,
        connectedPlanRowCount: connectedPlan.rows.length,
        connectedCostRowCount: manualCostRows.length,
        capacityAssumptions: capacityRows,
        capacityStatus: connectedCapacityRows.length > 0 ? "connected" : "model",
        planApproval: plan.approval,
        companyRevenueGoal: this.config.campaignPerformance.companyRevenueGoal,
        marketingBudgetRate: this.config.campaignPerformance.marketingBudgetRate,
        qualifiedLeadGoal,
        opportunityGoal,
        targetBookingRate,
        planStatus: plan.status,
        channelLeadGoalMethod: plan.leadMethod,
        channelBudgetGoalStatus: plan.budgetMethod,
        sourceReportIds: requestParams.reports
      });

      logger.info("Built reconciled campaign performance snapshot", {
        correlationId,
        month,
        soldEstimateRows: snapshot.sources.find((source) => source.name === "ServiceTitan Sold Estimates")?.rowCount ?? 0,
        soldJobs: snapshot.actual.soldJobs,
        soldAmount: snapshot.actual.soldAmount,
        completedRevenue: snapshot.actual.completedRevenue,
      });

      const rawSnapshot = await prisma.rawReportSnapshot.create({
        data: {
          family: DashboardFamily.CAMPAIGNS,
          tenantId: this.config.serviceTitan.tenantId,
          category: "campaign-performance",
          reportId: Object.values(requestParams.reports).join(","),
          requestHash: scopeKey,
          businessDateFrom,
          businessDateTo,
          sourceSnapshotTime: new Date(generatedAt),
          payloadJson: snapshot as unknown as Prisma.InputJsonValue,
          fetchedAt: new Date(generatedAt),
          ingestionRunId: ingestionRun.id
        }
      });

      await prisma.dashboardReadModel.upsert({
        where: { family_scopeKey: { family: DashboardFamily.CAMPAIGNS, scopeKey } },
        create: {
          family: DashboardFamily.CAMPAIGNS,
          scopeKey,
          businessDateFrom,
          businessDateTo,
          payloadJson: snapshot as unknown as Prisma.InputJsonValue,
          sourceSnapshotIds: [rawSnapshot.id],
          snapshotTime: new Date(generatedAt),
          ingestionRunId: ingestionRun.id
        },
        update: {
          businessDateFrom,
          businessDateTo,
          payloadJson: snapshot as unknown as Prisma.InputJsonValue,
          sourceSnapshotIds: [rawSnapshot.id],
          snapshotTime: new Date(generatedAt),
          ingestionRunId: ingestionRun.id
        }
      });

      await prisma.ingestionRun.update({
        where: { id: ingestionRun.id },
        data: { status: RunStatus.SUCCEEDED, responseMeta: { generatedAt, sourceCount: snapshot.sources.length }, sourceSnapshotTime: new Date(generatedAt), finishedAt: new Date() }
      });
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: { status: RunStatus.SUCCEEDED, finishedAt: new Date() }
      });
      logger.info("Campaign performance snapshot refreshed", { month, cutoff, correlationId });
      return { month, cutoff, generatedAt, sourceCount: snapshot.sources.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.ingestionRun.update({
        where: { id: ingestionRun.id },
        data: { status: RunStatus.FAILED, errorJson: { message }, finishedAt: new Date() }
      });
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: { status: RunStatus.FAILED, errorJson: { message }, finishedAt: new Date() }
      });
      throw error;
    }
  }
}
