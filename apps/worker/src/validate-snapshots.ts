import { prisma } from "@irbis/db";
import { createLogger } from "@irbis/utils";
import { DASHBOARD_FAMILY_MAP, buildDashboardReadModel } from "./read-models";
import { buildLatestSnapshotPlan } from "./snapshot-plan";
import { stableJson } from "./stable-json";

const logger = createLogger("worker-validate-snapshots");

async function main() {
  const plan = buildLatestSnapshotPlan();
  const failures: string[] = [];

  try {
    for (const item of plan) {
      const dashboardFamily = DASHBOARD_FAMILY_MAP[item.family];

      const readModel = await prisma.dashboardReadModel.findUnique({
        where: {
          family_scopeKey: {
            family: dashboardFamily,
            scopeKey: item.requestHash
          }
        }
      });

      const sourceSnapshotId = Array.isArray(readModel?.sourceSnapshotIds)
        ? readModel.sourceSnapshotIds.find((value): value is string => typeof value === "string")
        : null;

      const rawSnapshot = sourceSnapshotId
        ? await prisma.rawReportSnapshot.findUnique({
            where: {
              id: sourceSnapshotId
            }
          })
        : await prisma.rawReportSnapshot.findFirst({
            where: {
              family: dashboardFamily,
              requestHash: item.requestHash
            },
            orderBy: [{ sourceSnapshotTime: "desc" }, { fetchedAt: "desc" }]
          });

      if (!rawSnapshot || !readModel) {
        failures.push(`${item.label}: missing snapshot or read model`);
        continue;
      }

      const rebuilt = buildDashboardReadModel(item.family, rawSnapshot.payloadJson);

      if (stableJson(rebuilt) !== stableJson(readModel.payloadJson)) {
        failures.push(`${item.label}: read model mismatch`);
      }
    }

    logger.info("Snapshot validation finished", {
      checked: plan.length,
      failures: failures.length
    });

    if (failures.length > 0) {
      throw new Error(failures.join("; "));
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
