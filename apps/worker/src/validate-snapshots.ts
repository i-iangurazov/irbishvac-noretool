import { prisma } from "@irbis/db";
import { createLogger } from "@irbis/utils";
import { DASHBOARD_FAMILY_MAP, buildDashboardReadModel } from "./read-models";
import { buildLatestSnapshotPlan } from "./snapshot-plan";
import { stableJson } from "./stable-json";

const logger = createLogger("worker-validate-snapshots");

function findFirstDiffPath(left: unknown, right: unknown, basePath = "$"): string | null {
  if (stableJson(left) === stableJson(right)) {
    return null;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    const maxLength = Math.max(left.length, right.length);

    for (let index = 0; index < maxLength; index += 1) {
      if (index >= left.length || index >= right.length) {
        return `${basePath}[${index}]`;
      }

      const diff = findFirstDiffPath(left[index], right[index], `${basePath}[${index}]`);
      if (diff) {
        return diff;
      }
    }

    return basePath;
  }

  if (
    left &&
    right &&
    typeof left === "object" &&
    typeof right === "object" &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const keys = Array.from(
      new Set([...Object.keys(left as Record<string, unknown>), ...Object.keys(right as Record<string, unknown>)]),
    ).sort();

    for (const key of keys) {
      const diff = findFirstDiffPath(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key],
        `${basePath}.${key}`,
      );

      if (diff) {
        return diff;
      }
    }

    return basePath;
  }

  return basePath;
}

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
            orderBy: [{ fetchedAt: "desc" }, { sourceSnapshotTime: "desc" }]
          });

      if (!rawSnapshot || !readModel) {
        failures.push(`${item.label}: missing snapshot or read model`);
        continue;
      }

      const rebuilt = buildDashboardReadModel(item.family, rawSnapshot.payloadJson, {
        businessDate:
          rawSnapshot.businessDateTo ?? rawSnapshot.sourceSnapshotTime ?? rawSnapshot.fetchedAt
      });

      if (stableJson(rebuilt) !== stableJson(readModel.payloadJson)) {
        failures.push(
          `${item.label}: read model mismatch at ${findFirstDiffPath(rebuilt, readModel.payloadJson) ?? "$"}`,
        );
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
