import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  DashboardFamily,
  prisma,
  setDefaultMonthlyGoalEntries,
  type GoalTrackerEntry
} from "@irbis/db";
import {
  buildAdvisorDashboard,
  buildBookingRateSummary,
  buildCallCenterDashboard,
  buildCampaignDashboard,
  buildCapacitySummary,
  filterAdvisorDashboardByDepartment,
  filterInstallerDashboardByDepartment,
  filterTechnicianDashboardByDepartment,
  buildInstallerDashboard,
  buildJobCostingSummary,
  buildLeadGenerationDashboard,
  buildMarketingDonut,
  buildRevenueGoalSummary,
  buildRevenueMonthlyPace,
  buildSalesMonthlyPace,
  buildSalesSummary,
  buildTechnicianDashboard,
  buildTrendingModel,
  type FieldStaffDepartment
} from "@irbis/domain";
import {
  getServiceTitanReportDefinitions,
  resolveReportRequest,
  type ReportFamilyKey,
  type ReportRequestContext
} from "@irbis/integrations";
import { getConfig } from "@irbis/config";
import { createLogger, getDateParts, getDaysInBusinessMonth } from "@irbis/utils";
import { type GoalTrackerDto } from "../goals/goals.service";
import { DashboardRefreshService } from "./dashboard-refresh.service";

export type DashboardRequestContext = Pick<ReportRequestContext, "preset" | "from" | "to">;

export type CompanyWideDashboardResponse = {
  marketing: ReturnType<typeof buildMarketingDonut>;
  capacity: ReturnType<typeof buildCapacitySummary>;
  jobCostingSummary: ReturnType<typeof buildJobCostingSummary>;
  revenueGoals: ReturnType<typeof buildRevenueGoalSummary>;
  salesToday: ReturnType<typeof buildSalesSummary>;
  salesYesterday: ReturnType<typeof buildSalesSummary>;
  salesMonthlyPace: ReturnType<typeof buildSalesMonthlyPace>;
  revenueMonthlyPace: ReturnType<typeof buildRevenueMonthlyPace>;
  bookingRate: ReturnType<typeof buildBookingRateSummary>;
  trending: ReturnType<typeof buildTrendingModel>;
  goals: GoalTrackerDto[];
};

function toGoalTrackerDto(goal: GoalTrackerEntry): GoalTrackerDto {
  return {
    id: goal.id,
    year: goal.year,
    monthIndex: goal.monthIndex,
    monthName: goal.monthName,
    goalAmount: Number(goal.goalAmount),
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString()
  };
}

@Injectable()
export class DashboardService {
  private readonly config = getConfig();
  private readonly logger = createLogger("api-dashboard-service");
  private readonly reportDefinitions = getServiceTitanReportDefinitions();

  constructor(
    @Optional()
    @Inject(DashboardRefreshService)
    private readonly refreshService?: DashboardRefreshService,
  ) {}

  private async safeQuery<T>(operation: string, fallback: T, query: () => Promise<T>): Promise<T> {
    try {
      return await query();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn("Falling back because dashboard query failed", {
        operation,
        errorMessage
      });
      return fallback;
    }
  }

  private attachSnapshotTime<T>(payload: T, snapshotTime: Date | string | null | undefined): T {
    if (!snapshotTime || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      return payload;
    }

    const record = payload as Record<string, unknown>;
    if (typeof record.snapshotTime === "string" && record.snapshotTime.length > 0) {
      return payload;
    }

    return {
      ...record,
      snapshotTime: typeof snapshotTime === "string" ? snapshotTime : snapshotTime.toISOString()
    } as T;
  }

  private resolveRequest(reportFamily: ReportFamilyKey, context?: DashboardRequestContext) {
    return resolveReportRequest(this.reportDefinitions[reportFamily], {
      ...context,
      timezone: this.config.app.timezone
    });
  }

  private async getLatestSnapshot(family: DashboardFamily) {
    return this.safeQuery(`latest-snapshot:${family}`, null, () =>
      prisma.rawReportSnapshot.findFirst({
        where: { family },
        orderBy: [{ sourceSnapshotTime: "desc" }, { fetchedAt: "desc" }]
      }),
    );
  }

  private async getSnapshotForContext(
    family: DashboardFamily,
    reportFamily: ReportFamilyKey,
    context?: DashboardRequestContext,
  ) {
    const request = this.resolveRequest(reportFamily, context);

    return this.safeQuery(`snapshot:${family}:${request.requestHash}`, null, () =>
      prisma.rawReportSnapshot.findFirst({
        where: {
          family,
          requestHash: request.requestHash
        },
        orderBy: [{ sourceSnapshotTime: "desc" }, { fetchedAt: "desc" }]
      }),
    );
  }

  private async getScopedOrLatestSnapshot(
    family: DashboardFamily,
    reportFamily: ReportFamilyKey,
    context?: DashboardRequestContext,
  ) {
    return (await this.getSnapshotForContext(family, reportFamily, context)) ?? this.getLatestSnapshot(family);
  }

  private queueRefresh(reportFamily: ReportFamilyKey, context?: DashboardRequestContext) {
    void this.refreshService?.ensureRefreshEnqueued(reportFamily, context);
  }

  private async getReadModel<T>(
    family: DashboardFamily,
    reportFamily: ReportFamilyKey,
    context?: DashboardRequestContext,
  ): Promise<T | null> {
    const request = this.resolveRequest(reportFamily, context);
    const readModel = await this.safeQuery(`read-model:${family}:${request.requestHash}`, null, () =>
      prisma.dashboardReadModel.findUnique({
        where: {
          family_scopeKey: {
            family,
            scopeKey: request.requestHash
          }
        }
      }),
    );

    if (!readModel) {
      return null;
    }

    return this.attachSnapshotTime(readModel.payloadJson as T, readModel.snapshotTime);
  }

  private async getLatestReadModel<T>(family: DashboardFamily): Promise<T | null> {
    const readModel = await this.safeQuery(`read-model:${family}:latest`, null, () =>
      prisma.dashboardReadModel.findUnique({
        where: {
          family_scopeKey: {
            family,
            scopeKey: "latest"
          }
        }
      }),
    );

    if (!readModel) {
      return null;
    }

    return this.attachSnapshotTime(readModel.payloadJson as T, readModel.snapshotTime);
  }

  private async resolveMetricFamily<T>(
    family: DashboardFamily,
    reportFamily: ReportFamilyKey,
    build: (payload: unknown) => T,
    context?: DashboardRequestContext,
  ): Promise<T> {
    const readModel = await this.getReadModel<T>(family, reportFamily, context);
    if (readModel) {
      return readModel;
    }

    const scopedSnapshot = await this.getSnapshotForContext(family, reportFamily, context);
    if (scopedSnapshot) {
      return this.attachSnapshotTime(
        build(scopedSnapshot.payloadJson),
        scopedSnapshot.sourceSnapshotTime,
      );
    }

    if (context) {
      this.queueRefresh(reportFamily, context);
    }

    const latestReadModel = await this.getLatestReadModel<T>(family);
    if (latestReadModel) {
      return latestReadModel;
    }

    const latestSnapshot = await this.getLatestSnapshot(family);
    return this.attachSnapshotTime(
      build(latestSnapshot?.payloadJson ?? {}),
      latestSnapshot?.sourceSnapshotTime,
    );
  }

  private resolveGoalYear(context?: DashboardRequestContext) {
    const referenceDate = context?.to ?? context?.from;
    const businessDate = referenceDate
      ? new Date(`${referenceDate}T12:00:00.000Z`)
      : new Date();

    return getDateParts(businessDate, this.config.app.timezone).year;
  }

  private async getGoalsForContext(context?: DashboardRequestContext): Promise<GoalTrackerDto[]> {
    const goalYear = this.resolveGoalYear(context);
    const goals = await this.safeQuery(
      `goal-tracker:default-monthly:${goalYear}`,
      [] as GoalTrackerEntry[],
      () => setDefaultMonthlyGoalEntries(goalYear),
    );

    return goals.map(toGoalTrackerDto);
  }

  private async getTechnicianDashboardForDepartment(
    department: FieldStaffDepartment,
    context?: DashboardRequestContext,
  ) {
    const dashboard = await this.resolveMetricFamily(
      DashboardFamily.TECHNICIANS,
      "technicians",
      (payload) => buildTechnicianDashboard(payload),
      context,
    );

    return filterTechnicianDashboardByDepartment(dashboard, department);
  }

  async getTechnicians(context?: DashboardRequestContext) {
    return this.getTechnicianDashboardForDepartment("hvac-service", context);
  }

  async getPlumbingTechnicians(context?: DashboardRequestContext) {
    return this.getTechnicianDashboardForDepartment("plumbing-service", context);
  }

  async getElectricalTechnicians(context?: DashboardRequestContext) {
    return this.getTechnicianDashboardForDepartment("electrical-service", context);
  }

  async getInstallers(context?: DashboardRequestContext) {
    return this.getInstallerDashboardForDepartment("hvac-install", context);
  }

  async getPlumbingInstallers(context?: DashboardRequestContext) {
    return this.getInstallerDashboardForDepartment("plumbing-install", context);
  }

  async getElectricalInstallers(context?: DashboardRequestContext) {
    return this.getInstallerDashboardForDepartment("electrical-install", context);
  }

  private async getInstallerDashboardForDepartment(
    department: FieldStaffDepartment,
    context?: DashboardRequestContext,
  ) {
    const dashboard = await this.resolveMetricFamily(
      DashboardFamily.INSTALLERS,
      "installers",
      (payload) => buildInstallerDashboard(payload),
      context,
    );

    return filterInstallerDashboardByDepartment(dashboard, department);
  }

  async getAdvisors(context?: DashboardRequestContext) {
    const dashboard = await this.resolveMetricFamily(
      DashboardFamily.ADVISORS,
      "advisors",
      (payload) => buildAdvisorDashboard(payload),
      context,
    );

    return filterAdvisorDashboardByDepartment(dashboard, "hvac-comfort-advisor");
  }

  async getCallCenterSummary(context?: DashboardRequestContext) {
    return this.resolveMetricFamily(
      DashboardFamily.CALL_CENTER_SUMMARY,
      "callCenterSummary",
      (payload) => buildCallCenterDashboard(payload),
      context,
    );
  }

  async getCallCenterByCsr(context?: DashboardRequestContext) {
    return this.resolveMetricFamily(
      DashboardFamily.CALL_CENTER_BY_CSR,
      "callCenterByCsr",
      (payload) => buildCallCenterDashboard(payload),
      context,
    );
  }

  async getLeadGeneration(context?: DashboardRequestContext) {
    return this.resolveMetricFamily(
      DashboardFamily.LEADS,
      "leadGeneration",
      (payload) => buildLeadGenerationDashboard(payload),
      context,
    );
  }

  async getCampaigns(context?: DashboardRequestContext) {
    return this.resolveMetricFamily(
      DashboardFamily.CAMPAIGNS,
      "campaigns",
      (payload) => buildCampaignDashboard(payload),
      context,
    );
  }

  async getTrending(context?: DashboardRequestContext): Promise<ReturnType<typeof buildTrendingModel>> {
    const goalYear = this.resolveGoalYear(context);
    const [scopedSnapshot, latestSnapshot, goals] = await Promise.all([
      this.getSnapshotForContext(DashboardFamily.TRENDING, "trending", context),
      this.getLatestSnapshot(DashboardFamily.TRENDING),
      this.getGoalsForContext(context)
    ]);
    const snapshot = scopedSnapshot ?? latestSnapshot;

    if (!scopedSnapshot && context) {
      this.queueRefresh("trending", context);
    }

    return this.attachSnapshotTime(
      buildTrendingModel(
        snapshot?.payloadJson ?? {},
        goals.map((goal) => ({
          monthName: goal.monthName,
          goalAmount: Number(goal.goalAmount)
        })),
        { currentYear: goalYear },
      ),
      snapshot?.sourceSnapshotTime,
    );
  }

  async getCompanyWide(context?: DashboardRequestContext): Promise<CompanyWideDashboardResponse> {
    const now = new Date();
    const businessDay = getDateParts(now, this.config.app.timezone).day;
    const businessWeekdayName = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: this.config.app.timezone
    }).format(now);
    const goalYear = this.resolveGoalYear(context);

    const [
      marketing,
      capacity,
      jobCostingSummary,
      revenueGoals,
      salesToday,
      salesYesterday,
      salesMonthlyPace,
      revenueMonthlyPace,
      bookingRate,
      scopedTrendingSnapshot,
      latestTrendingSnapshot,
      goals
    ] = await Promise.all([
      this.resolveMetricFamily(
        DashboardFamily.MARKETING,
        "marketing",
        (payload) => buildMarketingDonut(payload),
        context,
      ),
      this.resolveMetricFamily(
        DashboardFamily.CAPACITY,
        "capacity",
        (payload) =>
          buildCapacitySummary(payload, {
            mode: "daily",
            currentWeekdayName: businessWeekdayName
          }),
        context,
      ),
      this.resolveMetricFamily(
        DashboardFamily.JOB_COSTING_SUMMARY,
        "jobCostingSummary",
        (payload) => buildJobCostingSummary(payload),
        context,
      ),
      this.resolveMetricFamily(
        DashboardFamily.REVENUE_GOALS,
        "revenueGoals",
        (payload) => buildRevenueGoalSummary(payload),
        context,
      ),
      this.resolveMetricFamily(
        DashboardFamily.SALES_TODAY,
        "salesToday",
        (payload) => buildSalesSummary(payload),
        context,
      ),
      this.resolveMetricFamily(
        DashboardFamily.SALES_YESTERDAY,
        "salesYesterday",
        (payload) => buildSalesSummary(payload),
        context,
      ),
      this.resolveMetricFamily(
        DashboardFamily.SALES_MONTHLY_PACE,
        "salesMonthlyPace",
        (payload) =>
          buildSalesMonthlyPace(payload, {
            businessDayOfMonth: businessDay,
            daysInMonth: getDaysInBusinessMonth(now, this.config.app.timezone)
          }),
        context,
      ),
      this.resolveMetricFamily(
        DashboardFamily.REVENUE_MONTHLY_PACE,
        "revenueMonthlyPace",
        (payload) => buildRevenueMonthlyPace(payload),
        context,
      ),
      this.resolveMetricFamily(
        DashboardFamily.BOOKING_RATE,
        "bookingRate",
        (payload) => buildBookingRateSummary(payload),
        context,
      ),
      this.getSnapshotForContext(DashboardFamily.TRENDING, "trending", context),
      this.getLatestSnapshot(DashboardFamily.TRENDING),
      this.getGoalsForContext(context)
    ]);
    const trendingSnapshot = scopedTrendingSnapshot ?? latestTrendingSnapshot;

    if (!scopedTrendingSnapshot && context) {
      this.queueRefresh("trending", context);
    }

    return {
      marketing,
      capacity,
      jobCostingSummary,
      revenueGoals,
      salesToday,
      salesYesterday,
      salesMonthlyPace,
      revenueMonthlyPace,
      bookingRate,
      trending: this.attachSnapshotTime(
        buildTrendingModel(
          trendingSnapshot?.payloadJson ?? {},
          goals.map((goal) => ({
            monthName: goal.monthName,
            goalAmount: Number(goal.goalAmount)
          })),
          { currentYear: goalYear },
        ),
        trendingSnapshot?.sourceSnapshotTime,
      ),
      goals
    };
  }
}
