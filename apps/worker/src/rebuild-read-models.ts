import { getConfig } from "@irbis/config";
import { DashboardFamily, Prisma, prisma } from "@irbis/db";
import {
  buildAdvisorDashboard,
  buildBookingRateSummary,
  buildCallCenterDashboard,
  buildCampaignDashboard,
  buildCapacitySummary,
  buildInstallerDashboard,
  buildJobCostingSummary,
  buildLeadGenerationDashboard,
  buildMarketingDonut,
  buildRevenueGoalSummary,
  buildRevenueMonthlyPace,
  buildSalesMonthlyPace,
  buildSalesSummary,
  buildTechnicianDashboard,
  buildTrendingModel
} from "@irbis/domain";
import {
  getServiceTitanReportDefinitions,
  resolveReportRequest,
  type ReportFamilyKey
} from "@irbis/integrations";
import { createLogger, getDateParts, getDaysInBusinessMonth } from "@irbis/utils";

const config = getConfig();
const logger = createLogger("worker-rebuild-read-models");
const reportDefinitions = getServiceTitanReportDefinitions();

const REPORT_FAMILY_BY_DASHBOARD_FAMILY: Partial<Record<DashboardFamily, ReportFamilyKey>> = {
  [DashboardFamily.TECHNICIANS]: "technicians",
  [DashboardFamily.INSTALLERS]: "installers",
  [DashboardFamily.ADVISORS]: "advisors",
  [DashboardFamily.CALL_CENTER_SUMMARY]: "callCenterSummary",
  [DashboardFamily.CALL_CENTER_BY_CSR]: "callCenterByCsr",
  [DashboardFamily.LEADS]: "leadGeneration",
  [DashboardFamily.CAMPAIGNS]: "campaigns",
  [DashboardFamily.TRENDING]: "trending",
  [DashboardFamily.MARKETING]: "marketing",
  [DashboardFamily.CAPACITY]: "capacity",
  [DashboardFamily.JOB_COSTING_SUMMARY]: "jobCostingSummary",
  [DashboardFamily.REVENUE_GOALS]: "revenueGoals",
  [DashboardFamily.SALES_TODAY]: "salesToday",
  [DashboardFamily.SALES_YESTERDAY]: "salesYesterday",
  [DashboardFamily.SALES_MONTHLY_PACE]: "salesMonthlyPace",
  [DashboardFamily.REVENUE_MONTHLY_PACE]: "revenueMonthlyPace",
  [DashboardFamily.BOOKING_RATE]: "bookingRate"
};

function buildReadModel(family: DashboardFamily, payload: unknown) {
  const today = new Date();
  const businessDay = getDateParts(today, config.app.timezone).day;
  const businessWeekdayName = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: config.app.timezone
  }).format(today);

  switch (family) {
    case DashboardFamily.TECHNICIANS:
      return buildTechnicianDashboard(payload);
    case DashboardFamily.INSTALLERS:
      return buildInstallerDashboard(payload);
    case DashboardFamily.ADVISORS:
      return buildAdvisorDashboard(payload);
    case DashboardFamily.CALL_CENTER_SUMMARY:
    case DashboardFamily.CALL_CENTER_BY_CSR:
      return buildCallCenterDashboard(payload);
    case DashboardFamily.LEADS:
      return buildLeadGenerationDashboard(payload);
    case DashboardFamily.CAMPAIGNS:
      return buildCampaignDashboard(payload);
    case DashboardFamily.MARKETING:
      return buildMarketingDonut(payload);
    case DashboardFamily.CAPACITY:
      return buildCapacitySummary(payload, {
        mode: "daily",
        currentWeekdayName: businessWeekdayName
      });
    case DashboardFamily.JOB_COSTING_SUMMARY:
      return buildJobCostingSummary(payload);
    case DashboardFamily.REVENUE_GOALS:
      return buildRevenueGoalSummary(payload);
    case DashboardFamily.SALES_TODAY:
    case DashboardFamily.SALES_YESTERDAY:
      return buildSalesSummary(payload);
    case DashboardFamily.SALES_MONTHLY_PACE:
      return buildSalesMonthlyPace(payload, {
        businessDayOfMonth: businessDay,
        daysInMonth: getDaysInBusinessMonth(today, config.app.timezone)
      });
    case DashboardFamily.REVENUE_MONTHLY_PACE:
      return buildRevenueMonthlyPace(payload);
    case DashboardFamily.BOOKING_RATE:
      return buildBookingRateSummary(payload);
    case DashboardFamily.TRENDING:
      return buildTrendingModel(payload);
  }
}

async function upsertReadModel(
  family: DashboardFamily,
  scopeKey: string,
  snapshot: Awaited<ReturnType<typeof prisma.rawReportSnapshot.findFirst>>,
) {
  if (!snapshot) {
    return;
  }

  const readModel = buildReadModel(family, snapshot.payloadJson) as Prisma.InputJsonValue;

  await prisma.dashboardReadModel.upsert({
    where: {
      family_scopeKey: {
        family,
        scopeKey
      }
    },
    create: {
      family,
      scopeKey,
      businessDateFrom: snapshot.businessDateFrom,
      businessDateTo: snapshot.businessDateTo,
      payloadJson: readModel,
      sourceSnapshotIds: [snapshot.id],
      snapshotTime: snapshot.sourceSnapshotTime
    },
    update: {
      businessDateFrom: snapshot.businessDateFrom,
      businessDateTo: snapshot.businessDateTo,
      payloadJson: readModel,
      sourceSnapshotIds: [snapshot.id],
      snapshotTime: snapshot.sourceSnapshotTime
    }
  });
}

function getScopedRequestHash(snapshot: {
  family: DashboardFamily;
  fetchedAt: Date;
  sourceSnapshotTime: Date | null;
  businessDateFrom: Date | null;
  businessDateTo: Date | null;
}) {
  const reportFamily = REPORT_FAMILY_BY_DASHBOARD_FAMILY[snapshot.family];
  if (!reportFamily) {
    throw new Error(`No report family mapping defined for ${snapshot.family}`);
  }
  const definition = reportDefinitions[reportFamily];
  const referenceDate =
    snapshot.sourceSnapshotTime ?? snapshot.businessDateTo ?? snapshot.businessDateFrom ?? snapshot.fetchedAt;
  const toDate = snapshot.businessDateTo ?? referenceDate;

  return resolveReportRequest(definition, {
    preset: definition.defaultPreset,
    timezone: config.app.timezone,
    to: toDate.toISOString().slice(0, 10),
    referenceDate
  }).requestHash;
}

async function main() {
  const snapshots = await prisma.rawReportSnapshot.findMany({
    orderBy: [
      { family: "asc" },
      { requestHash: "asc" },
      { sourceSnapshotTime: "desc" },
      { fetchedAt: "desc" }
    ]
  });

  const latestByScope = new Map<string, (typeof snapshots)[number]>();
  const latestByFamily = new Map<DashboardFamily, (typeof snapshots)[number]>();

  for (const snapshot of snapshots) {
    const scopeKey = `${snapshot.family}:${getScopedRequestHash(snapshot)}`;

    if (!latestByScope.has(scopeKey)) {
      latestByScope.set(scopeKey, snapshot);
    }

    if (!latestByFamily.has(snapshot.family)) {
      latestByFamily.set(snapshot.family, snapshot);
    }
  }

  for (const snapshot of latestByScope.values()) {
    await upsertReadModel(snapshot.family, getScopedRequestHash(snapshot), snapshot);
  }

  for (const [family, snapshot] of latestByFamily.entries()) {
    await upsertReadModel(family, "latest", snapshot);
  }

  logger.info("Read models rebuilt from local raw snapshots", {
    scopedCount: latestByScope.size,
    latestCount: latestByFamily.size
  });
}

void main()
  .catch((error) => {
    logger.error("Failed to rebuild read models", {
      message: error instanceof Error ? error.message : String(error)
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
