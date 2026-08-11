import { Injectable } from "@nestjs/common";
import { Queue, type ConnectionOptions } from "bullmq";
import { getConfig } from "@irbis/config";
import {
  getServiceTitanReportDefinitions,
  resolveReportRequest,
  type ReportFamilyKey
} from "@irbis/integrations";
import { createLogger, getRedisConnectionSettings } from "@irbis/utils";
import type { DashboardRequestContext } from "./dashboard.service";

type RefreshJob = {
  type: "refresh-family";
  family: ReportFamilyKey;
  context?: DashboardRequestContext;
} | {
  type: "refresh-campaign-performance";
  month: string;
};

function getBullConnection(urlString: string): ConnectionOptions {
  return getRedisConnectionSettings(urlString);
}

@Injectable()
export class DashboardRefreshService {
  private readonly config = getConfig();
  private readonly logger = createLogger("api-dashboard-refresh");
  private readonly reportDefinitions = getServiceTitanReportDefinitions();
  private readonly queue = new Queue<RefreshJob, unknown, string>("retool-replacement-refresh", {
    connection: getBullConnection(this.config.redis.url),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 65_000
      },
      removeOnComplete: 100,
      removeOnFail: 100
    }
  });

  async ensureRefreshEnqueued(family: ReportFamilyKey, context?: DashboardRequestContext) {
    try {
      const request = resolveReportRequest(this.reportDefinitions[family], {
        ...context,
        timezone: this.config.app.timezone
      });
      const jobId = `refresh:${family}:${request.requestHash}`;
      const existing = await this.queue.getJob(jobId);

      if (existing) {
        return false;
      }

      await this.queue.add(
        `refresh-${family}`,
        {
          type: "refresh-family",
          family,
          ...(context ? { context } : {})
        },
        { jobId },
      );

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn("Failed to enqueue dashboard refresh", { family, message });
      return false;
    }
  }

  async enqueueCampaignPerformanceRefresh(month: string) {
    const jobId = `campaign-performance-${month}`;
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (["active", "waiting", "delayed", "prioritized", "waiting-children"].includes(state)) {
        return { jobId: String(existing.id), state, reused: true };
      }
      await existing.remove();
    }

    const job = await this.queue.add(
      `refresh-campaign-performance-${month}`,
      { type: "refresh-campaign-performance", month },
      { jobId, attempts: 1, removeOnComplete: 100, removeOnFail: 100 },
    );
    return { jobId: String(job.id), state: "waiting", reused: false };
  }

  async getRefreshStatus(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job || job.data.type !== "refresh-campaign-performance") {
      return { jobId, state: "not-found", failedReason: null };
    }
    return {
      jobId,
      state: await job.getState(),
      failedReason: job.failedReason || null,
      result: job.returnvalue ?? null
    };
  }
}
