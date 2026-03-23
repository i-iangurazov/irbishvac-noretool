import { prisma } from "@irbis/db";
import { createLogger } from "@irbis/utils";
import { DashboardRefreshRunner } from "./runner";
import { buildLatestSnapshotPlan } from "./snapshot-plan";

const logger = createLogger("worker-refresh-latest");
const REQUEST_INTERVAL_MS = 65_000;
const skipUnresolvedReports = process.env.SKIP_UNRESOLVED_REPORTS === "true";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const runner = new DashboardRefreshRunner();

  if (!(await runner.isPersistenceAvailable())) {
    throw new Error("DATABASE_URL is not reachable");
  }

  if (!runner.isIngestionConfigured()) {
    throw new Error(
      `ServiceTitan configuration is incomplete: ${runner.getMissingIntegrationConfig().join(", ")}`,
    );
  }

  const plan = buildLatestSnapshotPlan({
    skipUnresolved: skipUnresolvedReports
  });
  const results: Array<{ label: string; status: "ok" | "failed"; message?: string }> = [];

  logger.info("Refreshing latest snapshot plan", {
    itemCount: plan.length,
    skipUnresolvedReports
  });

  try {
    for (const [index, item] of plan.entries()) {
      if (index > 0) {
        await sleep(REQUEST_INTERVAL_MS);
      }

      try {
        await runner.refreshFamily(item.family, `latest:${item.label}:${Date.now()}`, item.context);
        results.push({ label: item.label, status: "ok" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ label: item.label, status: "failed", message });
      }
    }

    const failures = results.filter((result) => result.status === "failed");
    logger.info("Latest snapshot refresh finished", {
      total: results.length,
      failures: failures.length
    });

    if (failures.length > 0) {
      throw new Error(
        `Snapshot refresh failed for: ${failures.map((failure) => failure.label).join(", ")}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
