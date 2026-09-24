import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { getConfig } from "@irbis/config";
import { prisma, type Prisma } from "@irbis/db";
import {
  normalizeKitchenDirectory,
  kitchenPublishedNews,
  type KitchenBoardData,
  type KitchenDirectory,
} from "@irbis/domain";
import { RipplingClient, RipplingApiError } from "@irbis/integrations";

import { preferKitchenCloudflarePhotos } from "./kitchen-photos";

const EMPTY_DIRECTORY = normalizeKitchenDirectory([], [], []);

@Injectable()
export class KitchenService implements OnModuleInit, OnModuleDestroy {
  private readonly config = getConfig();
  private readonly logger = new Logger("KitchenService");
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending: Promise<void> | null = null;
  private lastAttemptAt: string | null = null;
  private failed = false;

  onModuleInit() {
    if (!this.config.rippling.token) return;
    void this.refreshIfDue();
    this.timer = setInterval(
      () => {
        void this.refreshIfDue();
      },
      Math.min(5, this.config.rippling.syncIntervalMinutes) * 60_000,
    );
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async refreshIfDue() {
    try {
      const current = await prisma.kitchenSnapshot.findUnique({
        where: { id: "current" },
      });
      if (
        current &&
        Date.now() - current.syncedAt.getTime() <
          this.config.rippling.syncIntervalMinutes * 60_000
      )
        return;
      await this.refresh();
    } catch {
      this.failed = true;
      this.logger.warn(
        "Employee sync unavailable. Check database setup and Rippling access.",
      );
    }
  }

  async refresh(): Promise<void> {
    if (this.pending) return this.pending;
    this.pending = this.performRefresh().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async performRefresh() {
    if (!this.config.rippling.token) return;
    this.lastAttemptAt = new Date().toISOString();
    try {
      const client = new RipplingClient(
        this.config.rippling.token,
        this.config.rippling.apiVersion,
      );
      const raw = await client.directory();
      const ripplingDirectory = normalizeKitchenDirectory(
        raw.workers,
        raw.users,
        raw.departments,
      );
      const directory = await preferKitchenCloudflarePhotos(
        ripplingDirectory,
        this.config.assets,
      );
      const payloadJson = directory as unknown as Prisma.InputJsonValue;
      const syncedAt = new Date();
      // One atomic replacement: partial/failed pages never replace the last complete snapshot.
      await prisma.kitchenSnapshot.upsert({
        where: { id: "current" },
        create: { id: "current", payloadJson, syncedAt },
        update: { payloadJson, syncedAt },
      });
      this.failed = false;
      this.logger.log(
        `Employee sync complete: ${directory.employees.length} active employees.`,
      );
    } catch (error) {
      this.failed = true;
      // Never log upstream response bodies, employee values, tokens, or database connection strings.
      this.logger.warn(
        error instanceof RipplingApiError
          ? error.message
          : "Employee sync could not be saved.",
      );
    }
  }

  async board(): Promise<KitchenBoardData> {
    let newsInput: unknown = [];
    try {
      newsInput = JSON.parse(this.config.rippling.newsJson);
    } catch {
      /* Unconfigured content is an empty news screen. */
    }
    const common = {
      timezone: this.config.app.timezone,
      news: kitchenPublishedNews(
        newsInput,
        new Date(),
        this.config.app.timezone,
      ),
      lastAttemptAt: this.lastAttemptAt,
    };
    if (!this.config.rippling.token)
      return {
        ...common,
        directory: EMPTY_DIRECTORY,
        syncedAt: null,
        stale: false,
        status: "not_configured",
      };
    try {
      const saved = await prisma.kitchenSnapshot.findUnique({
        where: { id: "current" },
      });
      if (!saved)
        return {
          ...common,
          directory: EMPTY_DIRECTORY,
          syncedAt: null,
          stale: true,
          status: "unavailable",
        };
      const age = Date.now() - saved.syncedAt.getTime();
      // Retain a previous snapshot through short outages; stop displaying obsolete staff after 24 hours.
      if (age > this.config.rippling.maxStaleHours * 3_600_000) {
        return {
          ...common,
          directory: EMPTY_DIRECTORY,
          syncedAt: saved.syncedAt.toISOString(),
          stale: true,
          status: "unavailable",
        };
      }
      return {
        ...common,
        directory: saved.payloadJson as unknown as KitchenDirectory,
        syncedAt: saved.syncedAt.toISOString(),
        stale:
          this.failed ||
          age > this.config.rippling.syncIntervalMinutes * 60_000 + 5 * 60_000,
        status: "ready",
      };
    } catch {
      return {
        ...common,
        directory: EMPTY_DIRECTORY,
        syncedAt: null,
        stale: true,
        status: "unavailable",
      };
    }
  }
}
