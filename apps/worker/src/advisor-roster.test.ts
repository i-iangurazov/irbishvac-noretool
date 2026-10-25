import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ list: vi.fn(), upsert: vi.fn() }));
vi.mock("@irbis/config", () => ({
  getConfig: () => ({ serviceTitan: { businessUnits: { advisors: [1812] } } }),
}));
vi.mock("@irbis/db", () => ({
  DashboardFamily: { ADVISORS: "ADVISORS" },
  prisma: { dashboardReadModel: { upsert: mocks.upsert } },
}));
vi.mock("@irbis/integrations", () => ({
  MembershipSourceClient: class {
    list = mocks.list;
  },
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.upsert.mockResolvedValue({});
  mocks.list.mockImplementation(async (resource: string) =>
    resource === "technicians"
      ? [{ id: 123, name: "Future Seller", active: true, businessUnitId: 1812 }]
      : [{ id: 1812, name: "HVAC - Sales", active: true }],
  );
});
describe("sales staff ingestion", () => {
  it("persists only a complete sanitized BU roster and shares concurrent reads", async () => {
    const { refreshAdvisorRoster } = await import("./advisor-roster");
    await Promise.all([refreshAdvisorRoster(), refreshAdvisorRoster()]);
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.upsert).toHaveBeenCalledOnce();
    const data = mocks.upsert.mock.calls[0]![0].create;
    expect(data.scopeKey).toBe("staff-roster:v1");
    expect(data.payloadJson).toEqual([
      {
        technicianId: "123",
        name: "Future Seller",
        businessUnit: "HVAC - Sales",
      },
    ]);
    await refreshAdvisorRoster();
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });
  it("retains the previous roster when a source page fails, and permits a retry", async () => {
    const { refreshAdvisorRoster } = await import("./advisor-roster");
    mocks.list.mockRejectedValueOnce(Error("upstream"));
    await expect(refreshAdvisorRoster()).rejects.toThrow("upstream");
    expect(mocks.upsert).not.toHaveBeenCalled();
    await refreshAdvisorRoster();
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });
});
