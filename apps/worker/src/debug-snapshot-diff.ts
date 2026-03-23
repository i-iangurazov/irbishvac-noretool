import { prisma } from "@irbis/db";
import { DASHBOARD_FAMILY_MAP, buildDashboardReadModel } from "./read-models";
import { buildLatestSnapshotPlan } from "./snapshot-plan";
import { stableJson } from "./stable-json";

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
  const label = process.argv[2];

  if (!label) {
    throw new Error("Usage: node --import tsx apps/worker/src/debug-snapshot-diff.ts <family:preset>");
  }

  const item = buildLatestSnapshotPlan().find((entry) => entry.label === label);

  if (!item) {
    throw new Error(`No snapshot plan item found for ${label}`);
  }

  const dashboardFamily = DASHBOARD_FAMILY_MAP[item.family];
  const readModel = await prisma.dashboardReadModel.findUnique({
    where: {
      family_scopeKey: {
        family: dashboardFamily,
        scopeKey: item.requestHash
      }
    }
  });

  if (!readModel) {
    throw new Error(`No dashboard read model found for ${label}`);
  }

  const sourceSnapshotId = Array.isArray(readModel.sourceSnapshotIds)
    ? readModel.sourceSnapshotIds.find((value): value is string => typeof value === "string")
    : null;

  if (!sourceSnapshotId) {
    throw new Error(`Read model ${label} has no source snapshot id`);
  }

  const rawSnapshot = await prisma.rawReportSnapshot.findUnique({
    where: {
      id: sourceSnapshotId
    }
  });

  if (!rawSnapshot) {
    throw new Error(`Source snapshot ${sourceSnapshotId} not found for ${label}`);
  }

  const rebuilt = buildDashboardReadModel(item.family, rawSnapshot.payloadJson);
  const diffPath = findFirstDiffPath(rebuilt, readModel.payloadJson);

  console.log(
    JSON.stringify(
      {
        label,
        family: item.family,
        requestHash: item.requestHash,
        sourceSnapshotId,
        equal: stableJson(rebuilt) === stableJson(readModel.payloadJson),
        diffPath,
        rebuiltValue:
          diffPath && diffPath !== "$"
            ? diffPath
                .replace(/^\$\./, "")
                .split(/\.|\[(\d+)\]/)
                .filter(Boolean)
                .reduce<unknown>(
                  (value, segment) =>
                    Array.isArray(value)
                      ? value[Number(segment)]
                      : (value as Record<string, unknown>)?.[segment],
                  rebuilt,
                )
            : rebuilt,
        storedValue:
          diffPath && diffPath !== "$"
            ? diffPath
                .replace(/^\$\./, "")
                .split(/\.|\[(\d+)\]/)
                .filter(Boolean)
                .reduce<unknown>(
                  (value, segment) =>
                    Array.isArray(value)
                      ? value[Number(segment)]
                      : (value as Record<string, unknown>)?.[segment],
                  readModel.payloadJson,
                )
            : readModel.payloadJson
      },
      null,
      2,
    ),
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
