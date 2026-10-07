import { beforeEach, describe, expect, it, vi } from "vitest";

const getJob = vi.fn();
const add = vi.fn();
vi.mock("bullmq", () => ({ Queue: vi.fn().mockImplementation(function () { return { getJob, add }; }) }));
vi.mock("@irbis/config", () => ({ getConfig: () => ({ app: { timezone: "America/Los_Angeles" }, redis: { url: "redis://localhost:6379" } }) }));
vi.mock("@irbis/integrations", () => ({
  getServiceTitanReportDefinitions: () => ({}),
  resolveReportRequest: () => ({ requestHash: "historical-september" })
}));

describe("historical CSR refresh jobs", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["completed", "failed"])("replaces a retained %s job to retrieve later outcomes", async (state) => {
    const remove = vi.fn();
    getJob.mockResolvedValue({ getState: async () => state, finishedOn: Date.now() - 120_000, remove });
    const { DashboardRefreshService } = await import("./dashboard-refresh.service");
    expect(await new DashboardRefreshService().ensureRefreshEnqueued("callCenterByCsr")).toBe(true);
    expect(remove).toHaveBeenCalledOnce();
    expect(add).toHaveBeenCalledOnce();
  });
  it.each(["active", "waiting", "delayed", "prioritized"])("keeps a %s job", async (state) => {
    const remove = vi.fn();
    getJob.mockResolvedValue({ getState: async () => state, finishedOn: Date.now() - 120_000, remove });
    const { DashboardRefreshService } = await import("./dashboard-refresh.service");
    expect(await new DashboardRefreshService().ensureRefreshEnqueued("callCenterByCsr")).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });
  it("throttles recent failures and preserves other dashboard queue behavior", async () => {
    const remove = vi.fn();
    getJob.mockResolvedValue({ getState: async () => "failed", finishedOn: Date.now(), remove });
    const { DashboardRefreshService } = await import("./dashboard-refresh.service");
    const service = new DashboardRefreshService();
    expect(await service.ensureRefreshEnqueued("callCenterByCsr")).toBe(false);
    getJob.mockResolvedValue({ getState: async () => "completed", finishedOn: Date.now() - 120_000, remove });
    expect(await service.ensureRefreshEnqueued("technicians")).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });
});
