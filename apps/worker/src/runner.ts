import { Socket } from "node:net";
import { getConfig } from "@irbis/config";
import { Prisma, RunStatus, prisma } from "@irbis/db";
import {
  ServiceTitanClient,
  ServiceTitanRateLimitError,
  getServiceTitanReportDefinitions,
  resolveReportRequest,
  type ReportFamilyKey,
  type ReportRequestContext
} from "@irbis/integrations";
import { createLogger } from "@irbis/utils";
import { DASHBOARD_FAMILY_MAP, buildDashboardReadModel } from "./read-models";

const logger = createLogger("worker-runner");

export class DashboardRefreshRunner {
  private readonly config = getConfig();

  private readonly client = new ServiceTitanClient();
  private readonly maxRateLimitRetries = 3;

  isIngestionConfigured() {
    return this.client.isConfigured();
  }

  getMissingIntegrationConfig() {
    return this.client.getMissingConfiguration();
  }

  async isPersistenceAvailable() {
    const databaseUrl = new URL(this.config.database.url);
    const port = Number(databaseUrl.port || "5432");

    return new Promise<boolean>((resolve) => {
      const socket = new Socket();
      let finished = false;

      const close = (value: boolean) => {
        if (finished) {
          return;
        }

        finished = true;
        socket.destroy();
        resolve(value);
      };

      socket.setTimeout(500);
      socket.once("connect", () => close(true));
      socket.once("timeout", () => close(false));
      socket.once("error", () => close(false));
      socket.connect(port, databaseUrl.hostname);
    });
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private async refreshFamilyOnce(
    family: ReportFamilyKey,
    correlationId: string,
    context?: ReportRequestContext,
    attemptNumber = 1,
  ) {
    const definitions = getServiceTitanReportDefinitions();
    const definition = definitions[family];
    const dashboardFamily = DASHBOARD_FAMILY_MAP[family];

    if (
      !definition.category ||
      !definition.reportId ||
      definition.category === "UNRESOLVED" ||
      definition.reportId === "UNRESOLVED"
    ) {
      throw new Error(`Report mapping for ${family} is unresolved in env config`);
    }

    const request = resolveReportRequest(definition, {
      ...context,
      timezone: this.config.app.timezone
    });
    const parameters = request.parameters;
    const requestHash = request.requestHash;
    const idempotencyKey = `${family}:${requestHash}`;

    const jobRun = await prisma.jobRun.create({
      data: {
        family: dashboardFamily,
        queueName: "retool-replacement-refresh",
        jobName: `refresh-${family}`,
        status: RunStatus.RUNNING,
        correlationId,
        attempts: attemptNumber,
        payload: {
          family,
          parameters
        },
        startedAt: new Date()
      }
    });

    const ingestionRun = await prisma.ingestionRun.upsert({
      where: {
        idempotencyKey
      },
      create: {
        family: dashboardFamily,
        status: RunStatus.RUNNING,
        requestHash,
        idempotencyKey,
        businessDateFrom: new Date(`${request.range.from}T00:00:00.000Z`),
        businessDateTo: new Date(`${request.range.to}T00:00:00.000Z`),
        requestParams: parameters,
        responseMeta: {
          correlationId,
          requestHash,
          attemptNumber
        },
        startedAt: new Date(),
        jobRunId: jobRun.id
      },
      update: {
        status: RunStatus.RUNNING,
        requestHash,
        businessDateFrom: new Date(`${request.range.from}T00:00:00.000Z`),
        businessDateTo: new Date(`${request.range.to}T00:00:00.000Z`),
        requestParams: parameters,
        responseMeta: {
          correlationId,
          requestHash,
          attemptNumber
        },
        startedAt: new Date(),
        finishedAt: null,
        errorJson: Prisma.DbNull,
        jobRunId: jobRun.id
      }
    });

    try {
      const result = await this.client.fetchReport({
        family,
        category: definition.category,
        reportId: definition.reportId,
        parameters,
        correlationId
      });

      const rawSnapshot = await prisma.rawReportSnapshot.create({
        data: {
          family: dashboardFamily,
          legacyTableName: definition.legacyTableName,
          tenantId: this.config.serviceTitan.tenantId,
          category: definition.category,
          reportId: definition.reportId,
          requestHash,
          businessDateFrom: new Date(`${request.range.from}T00:00:00.000Z`),
          businessDateTo: new Date(`${request.range.to}T00:00:00.000Z`),
          payloadJson: result.payload,
          ingestionRunId: ingestionRun.id
        }
      });

      const readModel = buildDashboardReadModel(family, result.payload) as Prisma.InputJsonValue;

      await prisma.dashboardReadModel.upsert({
        where: {
          family_scopeKey: {
            family: dashboardFamily,
            scopeKey: requestHash
          }
        },
        create: {
          family: dashboardFamily,
          scopeKey: requestHash,
          payloadJson: readModel,
          sourceSnapshotIds: [rawSnapshot.id],
          snapshotTime: new Date(),
          ingestionRunId: ingestionRun.id
        },
        update: {
          payloadJson: readModel,
          sourceSnapshotIds: [rawSnapshot.id],
          snapshotTime: new Date(),
          ingestionRunId: ingestionRun.id
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
          payloadJson: readModel,
          sourceSnapshotIds: [rawSnapshot.id],
          snapshotTime: new Date(),
          ingestionRunId: ingestionRun.id
        },
        update: {
          payloadJson: readModel,
          sourceSnapshotIds: [rawSnapshot.id],
          snapshotTime: new Date(),
          ingestionRunId: ingestionRun.id
        }
      });

      await prisma.ingestionRun.update({
        where: { id: ingestionRun.id },
        data: {
          status: RunStatus.SUCCEEDED,
          responseMeta: {
            correlationId,
            requestHash,
            endpoint: result.endpoint,
            attemptNumber
          },
          finishedAt: new Date()
        }
      });

      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: RunStatus.SUCCEEDED,
          attempts: attemptNumber,
          finishedAt: new Date()
        }
      });

      logger.info("Refreshed dashboard family", { family, correlationId });
      return { family, readModel };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown worker error";

      await prisma.ingestionRun.update({
        where: { id: ingestionRun.id },
        data: {
          status: RunStatus.FAILED,
          errorJson:
            error instanceof ServiceTitanRateLimitError
              ? {
                  message,
                  retryAfterSeconds: error.retryAfterSeconds,
                  family
                }
              : { message },
          finishedAt: new Date()
        }
      });

      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: RunStatus.FAILED,
          attempts: attemptNumber,
          errorJson:
            error instanceof ServiceTitanRateLimitError
              ? {
                  message,
                  retryAfterSeconds: error.retryAfterSeconds,
                  family
                }
              : { message },
          finishedAt: new Date()
        }
      });

      if (error instanceof ServiceTitanRateLimitError) {
        logger.warn("Dashboard refresh rate limited", {
          family,
          correlationId,
          message,
          retryAfterSeconds: error.retryAfterSeconds
        });
      } else {
        logger.error("Dashboard refresh failed", { family, correlationId, message });
      }

      throw error;
    }
  }

  async refreshFamily(
    family: ReportFamilyKey,
    correlationId: string,
    context?: ReportRequestContext,
  ) {
    let attempt = 0;

    while (attempt < this.maxRateLimitRetries) {
      attempt += 1;

      try {
        return await this.refreshFamilyOnce(family, correlationId, context, attempt);
      } catch (error) {
        if (error instanceof ServiceTitanRateLimitError && attempt < this.maxRateLimitRetries) {
          const retryAfterSeconds = Math.max(error.retryAfterSeconds ?? 60, 60) + 2;
          logger.warn("Retrying dashboard refresh after ServiceTitan rate limit", {
            family,
            correlationId,
            attempt,
            retryAfterSeconds
          });
          await this.sleep(retryAfterSeconds * 1_000);
          continue;
        }

        throw error;
      }
    }
  }
}

export const PEOPLE_REFRESH_FAMILIES: ReportFamilyKey[] = [
  "technicians",
  "installers",
  "advisors",
  "callCenterSummary",
  "callCenterByCsr",
  "leadGeneration",
  "campaigns",
  "trending"
];

export const COMPANY_REFRESH_FAMILIES: ReportFamilyKey[] = [
  "marketing",
  "capacity",
  "jobCostingSummary",
  "revenueGoals",
  "salesToday",
  "salesYesterday",
  "salesMonthlyPace",
  "revenueMonthlyPace",
  "bookingRate"
];
