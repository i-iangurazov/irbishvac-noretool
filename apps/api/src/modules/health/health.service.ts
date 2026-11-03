import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { getConfig } from "@irbis/config";
import { prisma } from "@irbis/db";
import { checkRedisConnection, createLogger } from "@irbis/utils";

type DependencyStatus = {
  ok: boolean;
  detail?: string;
};

type SnapshotStatus = DependencyStatus & {
  latestSnapshotTime: string | null;
  staleThresholdMinutes: number;
};

function withOptionalDetail<T extends { ok: boolean }>(status: T, detail?: string) {
  if (!detail) {
    return status;
  }

  return {
    ...status,
    detail
  };
}

@Injectable()
export class HealthService {
  private readonly config = getConfig();
  private readonly logger = createLogger("api-health-service");
  private readonly snapshotStaleThresholdMinutes = 180;

  getLiveness() {
    return {
      ok: true,
      timestamp: new Date().toISOString()
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      return { ok: true };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn("Database health check failed", { detail });
      return {
        ok: false,
        detail
      };
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    return checkRedisConnection(this.config.redis.url, 1_000);
  }

  private async checkSnapshots(): Promise<SnapshotStatus> {
    try {
      const latestReadModel = await prisma.dashboardReadModel.findFirst({
        where: {
          scopeKey: "latest",
          snapshotTime: {
            not: null
          }
        },
        orderBy: {
          snapshotTime: "desc"
        },
        select: {
          snapshotTime: true
        }
      });

      if (!latestReadModel?.snapshotTime) {
        return {
          ok: false,
          detail: "No dashboard snapshots available yet",
          latestSnapshotTime: null,
          staleThresholdMinutes: this.snapshotStaleThresholdMinutes
        };
      }

      const ageMs = Date.now() - latestReadModel.snapshotTime.getTime();
      const maxAgeMs = this.snapshotStaleThresholdMinutes * 60 * 1_000;
      const detail =
        ageMs <= maxAgeMs
          ? undefined
          : `Latest dashboard snapshot is older than ${this.snapshotStaleThresholdMinutes} minutes`;

      return withOptionalDetail({
        ok: ageMs <= maxAgeMs,
        latestSnapshotTime: latestReadModel.snapshotTime.toISOString(),
        staleThresholdMinutes: this.snapshotStaleThresholdMinutes
      }, detail);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn("Snapshot health check failed", { detail });
      return {
        ok: false,
        detail,
        latestSnapshotTime: null,
        staleThresholdMinutes: this.snapshotStaleThresholdMinutes
      };
    }
  }

  async getReadiness() {
    const [database, redis, snapshots, personnel] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkSnapshots(),
      this.checkPersonnel()
    ]);

    const dependenciesOk = database.ok && redis.ok;
    const payload = {
      ok: dependenciesOk,
      degraded: dependenciesOk && (!snapshots.ok || !personnel.ok),
      timestamp: new Date().toISOString(),
      checks: {
        database,
        redis,
        snapshots,
        personnel
      }
    };

    if (!dependenciesOk) {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }

  async checkPersonnel() {
    const staleThresholdMinutes = this.config.personnel.maxAgeMinutes;
    try {
      const latest = await prisma.performancePersonnelSnapshot.findFirst({ orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } });
      const age = latest ? Date.now() - latest.fetchedAt.getTime() : Number.POSITIVE_INFINITY;
      return { ok: Number.isFinite(age) && age >= -300_000 && age <= staleThresholdMinutes * 60_000,
        latestSnapshotTime: latest?.fetchedAt.toISOString() ?? null, staleThresholdMinutes };
    } catch {
      return { ok: false, latestSnapshotTime: null, staleThresholdMinutes };
    }
  }
}
