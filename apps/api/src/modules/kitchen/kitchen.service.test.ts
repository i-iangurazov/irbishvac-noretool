import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  directory: vi.fn(),
  config: {
    assets: { publicBaseUrl: null },
    app: { timezone: "America/Los_Angeles" },
    rippling: {
      token: "test-token",
      apiVersion: "2024-08-01",
      syncIntervalMinutes: 60,
      maxStaleHours: 24,
      newsJson: "[]",
    },
  },
}));
vi.mock("@irbis/config", () => ({ getConfig: () => mocks.config }));
vi.mock("@irbis/db", () => ({
  prisma: {
    kitchenSnapshot: { findUnique: mocks.findUnique, upsert: mocks.upsert },
  },
}));
vi.mock("@irbis/integrations", () => ({
  RipplingClient: class {
    directory = mocks.directory;
  },
  RipplingApiError: class extends Error {},
}));
import { KitchenService } from "./kitchen.service";

describe("kitchen synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.rippling.token = "test-token";
    mocks.findUnique.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue({});
  });

  it("saves only normalized data and replaces the active roster atomically", async () => {
    mocks.directory.mockResolvedValue({
      workers: [
        {
          id: "1",
          user_id: "u",
          status: "ACTIVE",
          date_of_birth: "1985-09-22",
          original_start_date: "2018-01-01",
        },
        { id: "2", status: "TERMINATED" },
      ],
      users: [
        {
          id: "u",
          display_name: "Test Person",
          emails: ["secret@example.com"],
        },
      ],
      departments: [],
    });
    await new KitchenService().refresh();
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const args = mocks.upsert.mock.calls[0]?.[0];
    expect(args.update.payloadJson.employees).toHaveLength(1);
    expect(JSON.stringify(args)).not.toContain("1985");
    expect(JSON.stringify(args)).not.toContain("secret@example.com");
  });

  it("keeps the existing snapshot when the upstream request fails", async () => {
    mocks.directory.mockRejectedValue(new Error("upstream failed"));
    const service = new KitchenService();
    await service.refresh();
    expect(mocks.upsert).not.toHaveBeenCalled();
    mocks.findUnique.mockResolvedValue({
      payloadJson: { employees: [], quality: {} },
      syncedAt: new Date(),
    });
    expect(await service.board()).toMatchObject({
      status: "ready",
      stale: true,
    });
  });

  it("deduplicates simultaneous refreshes", async () => {
    mocks.directory.mockResolvedValue({
      workers: [],
      users: [],
      departments: [],
    });
    const service = new KitchenService();
    await Promise.all([service.refresh(), service.refresh()]);
    expect(mocks.directory).toHaveBeenCalledTimes(1);
  });

  it("refreshes a snapshot when it becomes due after a service restart", async () => {
    vi.useFakeTimers();
    mocks.findUnique.mockResolvedValue({
      syncedAt: new Date(Date.now() - 59 * 60_000),
    });
    mocks.directory.mockResolvedValue({
      workers: [],
      users: [],
      departments: [],
    });
    const service = new KitchenService();
    try {
      service.onModuleInit();
      await vi.advanceTimersByTimeAsync(0);
      expect(mocks.directory).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(mocks.directory).toHaveBeenCalledTimes(1);
    } finally {
      service.onModuleDestroy();
      vi.useRealTimers();
    }
  });

  it("does not serve indefinitely stale employee information", async () => {
    mocks.findUnique.mockResolvedValue({
      payloadJson: { employees: [{ id: "old" }] },
      syncedAt: new Date(Date.now() - 25 * 3_600_000),
    });
    const result = await new KitchenService().board();
    expect(result.status).toBe("unavailable");
    expect(result.directory.employees).toEqual([]);
  });

  it("does not expose previous data when Rippling is disabled", async () => {
    mocks.config.rippling.token = "";
    expect(await new KitchenService().board()).toMatchObject({
      status: "not_configured",
      directory: { employees: [] },
    });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
