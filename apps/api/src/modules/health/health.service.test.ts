import { ServiceUnavailableException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawUnsafe, findFirst, checkRedisConnection, warn } = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
  findFirst: vi.fn(),
  checkRedisConnection: vi.fn(),
  warn: vi.fn()
}));

vi.mock("@irbis/db", () => ({
  prisma: {
    $queryRawUnsafe: queryRawUnsafe,
    dashboardReadModel: {
      findFirst
    }
  }
}));

vi.mock("@irbis/config", () => ({
  getConfig: () => ({
    redis: {
      url: "rediss://example.upstash.io:6379"
    }
  })
}));

vi.mock("@irbis/utils", () => ({
  checkRedisConnection,
  createLogger: () => ({
    warn
  })
}));

import { HealthService } from "./health.service";

describe("HealthService", () => {
  beforeEach(() => {
    queryRawUnsafe.mockReset();
    findFirst.mockReset();
    checkRedisConnection.mockReset();
    warn.mockReset();
  });

  it("returns degraded readiness when dependencies are healthy but snapshots are missing", async () => {
    queryRawUnsafe.mockResolvedValue([{ ok: 1 }]);
    checkRedisConnection.mockResolvedValue({ ok: true });
    findFirst.mockResolvedValue(null);

    const service = new HealthService();
    await expect(service.getReadiness()).resolves.toMatchObject({
      ok: true,
      degraded: true,
      checks: {
        database: { ok: true },
        redis: { ok: true },
        snapshots: {
          ok: false,
          latestSnapshotTime: null
        }
      }
    });
  });

  it("throws when a hard dependency is unavailable", async () => {
    queryRawUnsafe.mockRejectedValue(new Error("db offline"));
    checkRedisConnection.mockResolvedValue({ ok: true });
    findFirst.mockResolvedValue(null);

    const service = new HealthService();

    await expect(service.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
