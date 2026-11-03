import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PerformancePlan } from "./performance-data";
const { fetchApi, loadPersonnelPlans } = vi.hoisted(() => ({ fetchApi: vi.fn(), loadPersonnelPlans: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./api", () => ({ fetchApi }));
vi.mock("./performance-personnel", () => ({ loadPersonnelPlans }));
import { loadPerformanceRoster } from "./performance-source";

const plan = (kind: "technician" | "advisor", id: string): PerformancePlan => ({
  technicianId: id, slug: `staff-${id}`, technician: `Staff ${id}`, department: kind === "advisor" ? "HVAC Sales" : "HVAC Service",
  aliases: [], sourceKind: kind, month: "2026-11", approvalStatus: "ACTIVE", monthlySalesGoal: 30000,
  targetOpportunitiesMonthly: 75, targetRate: .5, targetRateType: "close", targetAverage: 1000,
  turnoverQuota: null, membershipMonthlyGoal: null,
});
beforeEach(() => {
  fetchApi.mockReset(); loadPersonnelPlans.mockReset();
});
describe("live coaching source agreement", () => {
  it("preserves missing scorecards and requests the exact cutoff for both roles", async () => {
    loadPersonnelPlans.mockResolvedValue([plan("technician", "tech"), plan("advisor", "advisor"), plan("advisor", "zero")]);
    fetchApi.mockImplementation(async (path: string) => {
      const common = { snapshotTime: "2026-11-03T07:00:00Z" };
      if (path.includes("field-pro")) return { ...common, rows: [] };
      if (path.includes("technicians")) return { ...common, rowsRanked: [{ name:"Staff tech", technicianId:"tech", totalSales:0, salesOpportunity:0, closedOpportunities:0, closeRate:0, avgSaleFromOpps:0, membershipsSold:0, actualSourceAvailable:false }] };
      return { ...common, rowsRanked: ["advisor", "zero"].map(id => ({ name:`Staff ${id}`, technicianId:id, totalSales:0, salesOpportunitiesCount:0, closedOpportunitiesCount:0, closeRateRolling:0, closedAverageSale:0, actualSourceAvailable:id === "zero" })) };
    });
    const rows = await loadPerformanceRoster("2026-11-01");
    for (const id of ["tech", "advisor"]) expect(rows.find(row=>row.technicianId===id)).toMatchObject({actual:null,pace:null,paceGap:null,status:"missing-data"});
    expect(rows.find(row=>row.technicianId==="zero")).toMatchObject({pace:0,status:"off-track"});
    expect(fetchApi).toHaveBeenCalledWith("/dashboard/performance/technicians?from=2026-11-01&to=2026-11-01");
    expect(fetchApi).toHaveBeenCalledWith("/dashboard/performance/advisors?from=2026-11-01&to=2026-11-01");
    expect(fetchApi).toHaveBeenCalledWith("/dashboard/performance/field-pro?from=2026-11-01&to=2026-11-01");
    expect(loadPersonnelPlans).toHaveBeenCalledWith("2026-11");
  });
});
