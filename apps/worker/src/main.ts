import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { getConfig } from "@irbis/config";
import { ServiceTitanRateLimitError, type ReportRequestContext } from "@irbis/integrations";
import { createLogger, getRedisConnectionSettings } from "@irbis/utils";
import {
  COMPANY_REFRESH_FAMILIES,
  DashboardRefreshRunner,
  PEOPLE_REFRESH_FAMILIES
} from "./runner";
import { buildLatestSnapshotPlan } from "./snapshot-plan";

type RefreshJob =
  | {
      type: "refresh-family";
      family: Parameters<DashboardRefreshRunner["refreshFamily"]>[0];
      context?: Pick<ReportRequestContext, "preset" | "from" | "to">;
    }
  | { type: "refresh-pipeline"; pipeline: "people" | "company" };

const logger = createLogger("worker-main");
const config = getConfig();

function getBullConnection(urlString: string): ConnectionOptions {
  return getRedisConnectionSettings(urlString);
}

const connection = getBullConnection(config.redis.url);

const queueName = "retool-replacement-refresh";
const refreshQueue = new Queue<RefreshJob, unknown, string>(queueName, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 45_000
    },
    removeOnComplete: 100,
    removeOnFail: 100
  }
});
const runner = new DashboardRefreshRunner();

const worker = new Worker<RefreshJob, unknown, string>(
  queueName,
  async (job) => {
    if (!(await runner.isPersistenceAvailable())) {
      logger.warn("Skipping worker job because database is unavailable", {
        jobId: job.id,
        name: job.name
      });

      return {
        status: "skipped",
        reason: "database_unavailable"
      };
    }

    if (!runner.isIngestionConfigured()) {
      logger.warn("Skipping worker job because ServiceTitan configuration is incomplete", {
        jobId: job.id,
        name: job.name,
        missing: runner.getMissingIntegrationConfig()
      });

      return {
        status: "skipped",
        reason: "missing_servicetitan_config"
      };
    }

    const correlationId = `${job.id ?? "job"}:${Date.now()}`;

    if (job.data.type === "refresh-family") {
      return runner.refreshFamily(job.data.family, correlationId, job.data.context);
    }

    const families =
      job.data.pipeline === "people" ? PEOPLE_REFRESH_FAMILIES : COMPANY_REFRESH_FAMILIES;

    const results = [];
    for (const family of families) {
      results.push(await runner.refreshFamily(family, correlationId));
    }

    return results;
  },
  {
    connection,
    limiter: {
      max: 1,
      duration: 65_000
    }
  }
);

worker.on("completed", (job) => {
  logger.info("Worker job completed", { jobId: job.id, name: job.name });
});

worker.on("failed", (job, error) => {
  if (error instanceof ServiceTitanRateLimitError) {
    logger.warn("Worker job rate limited", {
      jobId: job?.id,
      name: job?.name,
      message: error.message,
      retryAfterSeconds: error.retryAfterSeconds
    });
    return;
  }

  logger.error("Worker job failed", {
    jobId: job?.id,
    name: job?.name,
    message: error.message
  });
});

async function bootstrap() {
  logger.info("Worker started", { queueName });

  if (!config.worker.bootstrapOnStart) {
    logger.info("Worker bootstrap refresh is disabled for this environment");
    return;
  }

  if (!(await runner.isPersistenceAvailable())) {
    logger.warn("Worker booted without a reachable database; refresh bootstrap skipped");
    return;
  }

  if (!runner.isIngestionConfigured()) {
    logger.warn("Worker booted without full ServiceTitan configuration; refresh bootstrap skipped", {
      missing: runner.getMissingIntegrationConfig()
    });
    return;
  }

  const plan = buildLatestSnapshotPlan();

  for (const item of plan) {
    await refreshQueue.add(
      `bootstrap-${item.family}-${item.context.preset ?? "default"}`,
      {
        type: "refresh-family",
        family: item.family,
        ...(item.context ? { context: item.context } : {})
      },
      {
        jobId: `bootstrap:${item.family}:${item.requestHash}`
      }
    );
  }

  logger.info("Enqueued snapshot bootstrap plan", { itemCount: plan.length });
}

void bootstrap();
