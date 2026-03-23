import { getConfig } from "@irbis/config";
import { Prisma, prisma } from "@irbis/db";
import {
  RetoolDbClient,
  getServiceTitanReportDefinitions,
  resolveReportRequest,
  type ReportFamilyKey
} from "@irbis/integrations";
import { createLogger, getDateParts } from "@irbis/utils";
import { DASHBOARD_FAMILY_MAP, buildDashboardReadModel } from "./read-models";

const logger = createLogger("worker-retool-sync");
const config = getConfig();

const TABLE_FAMILY_MAP: Record<string, ReportFamilyKey> = {
  st_technician: "technicians",
  st_installer: "installers",
  st_advisors: "advisors",
  st_per_csr: "callCenterSummary",
  st_per_summary: "callCenterByCsr",
  st_lead: "leadGeneration",
  st_campaign: "campaigns",
  st_trending: "trending",
  st_marketing: "marketing",
  st_capacity: "capacity",
  st_job_costing_summary: "jobCostingSummary",
  st_revenue: "revenueGoals",
  st_sales: "salesToday",
  st_sales_yes: "salesYesterday",
  st_sales_monthly_pace: "salesMonthlyPace",
  st_revenue_monthly_pace: "revenueMonthlyPace",
  st_booking_rate: "bookingRate"
};

async function upsertGoalTrackerEntries(client: RetoolDbClient) {
  const goals = await client.fetchGoalTrackerRows();
  const currentYear = getDateParts(new Date(), config.app.timezone).year;

  for (const goal of goals) {
    await prisma.goalTrackerEntry.upsert({
      where: {
        year_monthIndex: {
          year: currentYear,
          monthIndex: goal.monthIndex
        }
      },
      create: {
        year: currentYear,
        monthIndex: goal.monthIndex,
        monthName: goal.monthName,
        goalAmount: goal.goalAmount
      },
      update: {
        monthName: goal.monthName,
        goalAmount: goal.goalAmount
      }
    });
  }

  return goals.length;
}

async function upsertSnapshot(tableName: keyof typeof TABLE_FAMILY_MAP, client: RetoolDbClient) {
  const family = TABLE_FAMILY_MAP[tableName];

  if (!family) {
    throw new Error(`No report family mapping found for Retool table ${tableName}`);
  }

  const definition = getServiceTitanReportDefinitions()[family];
  const dashboardFamily = DASHBOARD_FAMILY_MAP[family];
  const snapshot = await client.fetchLatestSnapshot(tableName);

  if (!snapshot) {
    return false;
  }

  const request = resolveReportRequest(definition, {
    preset: definition.defaultPreset,
    timezone: config.app.timezone,
    referenceDate: snapshot.snapshotTime
  });
  const sourceSnapshotTime = snapshot.snapshotTime;
  const existing = await prisma.rawReportSnapshot.findFirst({
    where: {
      family: dashboardFamily,
      requestHash: request.requestHash,
      sourceSnapshotTime
    }
  });

  const rawSnapshot =
    existing ??
    (await prisma.rawReportSnapshot.create({
      data: {
        family: dashboardFamily,
        legacyTableName: tableName,
        tenantId: config.serviceTitan.tenantId,
        category: definition.category === "UNRESOLVED" ? "retool-db" : definition.category,
        reportId: definition.reportId === "UNRESOLVED" ? tableName : definition.reportId,
        requestHash: request.requestHash,
        businessDateFrom: new Date(`${request.range.from}T00:00:00.000Z`),
        businessDateTo: new Date(`${request.range.to}T00:00:00.000Z`),
        sourceSnapshotTime,
        payloadJson: snapshot.payload as Prisma.InputJsonValue,
        fetchedAt: sourceSnapshotTime
      }
    }));

  const readModel = buildDashboardReadModel(family, snapshot.payload) as Prisma.InputJsonValue;

  await prisma.dashboardReadModel.upsert({
    where: {
      family_scopeKey: {
        family: dashboardFamily,
        scopeKey: request.requestHash
      }
    },
    create: {
      family: dashboardFamily,
      scopeKey: request.requestHash,
      businessDateFrom: new Date(`${request.range.from}T00:00:00.000Z`),
      businessDateTo: new Date(`${request.range.to}T00:00:00.000Z`),
      payloadJson: readModel,
      sourceSnapshotIds: [rawSnapshot.id],
      snapshotTime: sourceSnapshotTime
    },
    update: {
      businessDateFrom: new Date(`${request.range.from}T00:00:00.000Z`),
      businessDateTo: new Date(`${request.range.to}T00:00:00.000Z`),
      payloadJson: readModel,
      sourceSnapshotIds: [rawSnapshot.id],
      snapshotTime: sourceSnapshotTime
    }
  });

  await prisma.dashboardReadModel.upsert({
    where: {
      family_scopeKey: {
        family: dashboardFamily,
        scopeKey: "latest"
      }
    },
    create: {
      family: dashboardFamily,
      scopeKey: "latest",
      businessDateFrom: new Date(`${request.range.from}T00:00:00.000Z`),
      businessDateTo: new Date(`${request.range.to}T00:00:00.000Z`),
      payloadJson: readModel,
      sourceSnapshotIds: [rawSnapshot.id],
      snapshotTime: sourceSnapshotTime
    },
    update: {
      businessDateFrom: new Date(`${request.range.from}T00:00:00.000Z`),
      businessDateTo: new Date(`${request.range.to}T00:00:00.000Z`),
      payloadJson: readModel,
      sourceSnapshotIds: [rawSnapshot.id],
      snapshotTime: sourceSnapshotTime
    }
  });

  logger.info("Imported latest Retool snapshot", {
    tableName,
    family,
    sourceSnapshotTime: sourceSnapshotTime.toISOString()
  });

  return true;
}

async function main() {
  const client = new RetoolDbClient();

  if (!client.isConfigured()) {
    throw new Error("RETOOL_DATABASE_URL is not configured");
  }

  const imported = [];

  try {
    for (const tableName of Object.keys(TABLE_FAMILY_MAP) as Array<keyof typeof TABLE_FAMILY_MAP>) {
      const didImport = await upsertSnapshot(tableName, client);
      if (didImport) {
        imported.push(tableName);
      }
    }

    const goalsCount = await upsertGoalTrackerEntries(client);

    logger.info("Retool DB sync completed", {
      importedTables: imported,
      goalsCount
    });
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

void main();
