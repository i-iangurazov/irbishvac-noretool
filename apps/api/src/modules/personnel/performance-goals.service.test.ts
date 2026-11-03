import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPerformancePersonnelDirectory } from "@irbis/domain";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), upsert: vi.fn() }));
vi.mock("@irbis/db", () => ({ prisma: { performanceGoalVersion: mocks } }));
import { PerformanceGoalsService } from "./performance-goals.service";

describe("central approval versions", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("takes the newest version for the exact ID, month and department", async () => {
    const directory = buildPerformancePersonnelDirectory([{ id: 1, name: "A", active: true, isManagedTech: true, businessUnitId: 2 }], [{ id: 2, name: "HVAC - Sales", active: true }]);
    const base = { technicianId: "1", technician: "A", month: "2026-11", report_department: "HVAC Sales", approval_status: "ACTIVE", target_opportunities_monthly: 75 };
    mocks.findMany.mockResolvedValue([
      { technicianId: "1", department: "HVAC Sales", payloadJson: { ...base, monthly_sales_goal: 20000 } },
      { technicianId: "1", department: "HVAC Sales", payloadJson: { ...base, monthly_sales_goal: 10000 } },
    ]);
    const result = await new PerformanceGoalsService().attach(directory, "2026-11");
    expect(result.staff[0]?.goal.monthly_sales_goal).toBe(20000);
    expect(mocks.findMany).toHaveBeenCalledWith({ where: { month: "2026-11" }, orderBy: { createdAt: "desc" } });
  });
  it("replays an identical approval but rejects changed content under the same key", async () => {
    const goal = { technicianId: "1", technician: "A", month: "2026-11", report_department: "HVAC Sales", approval_status: "ACTIVE" as const, source_note: "approved email", monthly_sales_goal: 10000, target_opportunities_monthly: 75, target_rate: .3, target_average: 2000, membership_monthly_goal: null, review_monthly_goal: null, working_days: null };
    const input = { sourceKey: "email-1", approvedBy: "manager", goal };
    mocks.upsert.mockResolvedValue({ id: "saved", approvedBy: "manager", payloadJson: { ...goal } });
    expect((await new PerformanceGoalsService().approve(input)).id).toBe("saved");
    await expect(new PerformanceGoalsService().approve({ ...input, goal: { ...goal, monthly_sales_goal: 20000 } })).rejects.toThrow(/different goal/);
  });
  it("does not silently replace a goal database outage with missing goals", async () => {
    mocks.findMany.mockRejectedValue(new Error("goal database offline"));
    await expect(new PerformanceGoalsService().attach(buildPerformancePersonnelDirectory([], []), "2026-11")).rejects.toThrow(/offline/);
  });
});
