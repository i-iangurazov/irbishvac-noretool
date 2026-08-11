import { getConfig } from "@irbis/config";
import { DashboardFamily, Prisma, RunStatus, prisma } from "@irbis/db";
import {
  buildCampaignPerformanceSnapshot,
  normalizeCampaignChannel,
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
  ["Facebook", 53, 21, 5957.11, 85101.62],
  ["GBP San Jose", 60, 58, 10645.90, 152084.25],
  ["Miscellaneous", 81, 60, 219.16, 3130.79],
  ["Google LSA", 19, 17, 259.57, 3708.18],
  ["Home Care Plan", 21, 21, null, null],
  ["Now Operator", 0, null, null, null],
  ["669-COOLING", 29, 26, 12869.77, 183853.91],
  ["Scheduling Pro", 35, 33, null, null],
  ["Carrier", 13, 12, 408.83, 5840.46],
  ["Hatch Campaigns", 20, 20, 3041.42, 43448.84],
  ["Mail Shark", 8, 8, 15.80, 225.69],
  ["Existing Customers", 0, null, 21476.37, 306805.32]
].map(([channel, qualifiedLeads, bookedJobs, spend, completedRevenue]) => ({
  channel: String(channel),
  qualifiedLeads: Number(qualifiedLeads),
  bookedJobs: bookedJobs == null ? null : Number(bookedJobs),
  spend: spend == null ? null : Number(spend),
  soldAmount: null,
  completedRevenue: completedRevenue == null ? null : Number(completedRevenue)
}));

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
      status: "MODEL PLAN",
      leadMethod: "1,125 booked-opportunity capacity model scaled from July channel mix; channel allocation awaits Emil approval.",
      budgetMethod: "Model allocation by July completed-revenue share"
    };
  }
  return {
    rows: [] as CampaignPlanRow[],
    status: "PLAN REQUIRED",
    leadMethod: "No approved channel plan is connected for this month.",
    budgetMethod: "No approved channel budget is connected for this month."
  };
}

function parseConnectedPlan(values: unknown[][] | undefined) {
  if (!values || values.length < 2) return [];
  const rows: CampaignPlanRow[] = [];
  for (const row of values.slice(1)) {
    const channel = normalizeCampaignChannel(row[0]);
    const qualifiedLeads = Number(row[1]);
    const optionalNumber = (value: unknown) => {
      if (value == null || value === "") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const bookedJobs = optionalNumber(row[2]);
    if (
      channel === "Other" ||
      !Number.isFinite(qualifiedLeads) ||
      qualifiedLeads < 0 ||
      bookedJobs == null ||
      bookedJobs < 0
    ) continue;
    rows.push({
      channel,
      qualifiedLeads,
      bookedJobs,
      spend: optionalNumber(row[3]),
      soldAmount: optionalNumber(row[4]),
      completedRevenue: optionalNumber(row[5])
    });
  }
  return rows;
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
      const connectedPlanSheet = await this.sheets.getOptionalValues("Campaign Plan!A:F");
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

      const fallbackPlan = planForMonth(
        month,
        this.config.campaignPerformance.opportunityGoal,
        this.config.campaignPerformance.targetBookingRate,
      );
      const connectedPlanRows = parseConnectedPlan(connectedPlanSheet?.values);
      const plan = connectedPlanRows.length > 0
        ? {
            rows: connectedPlanRows,
            status: "CONNECTED PLAN",
            leadMethod: "Channel goals read from the Google Sheet Campaign Plan tab.",
            budgetMethod: "Channel budgets read from the Google Sheet Campaign Plan tab."
          }
        : fallbackPlan;
      const connectedLeadGoal = plan.rows.reduce((sum, row) => sum + row.qualifiedLeads, 0);
      const connectedOpportunityGoal = plan.rows.reduce((sum, row) => sum + (row.bookedJobs ?? 0), 0);
      const qualifiedLeadGoal = connectedPlanRows.length > 0
        ? connectedLeadGoal
        : Math.round(
            this.config.campaignPerformance.opportunityGoal /
            this.config.campaignPerformance.targetBookingRate,
          );
      const opportunityGoal = connectedPlanRows.length > 0
        ? connectedOpportunityGoal
        : this.config.campaignPerformance.opportunityGoal;
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
