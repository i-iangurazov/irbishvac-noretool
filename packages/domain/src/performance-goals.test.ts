import { describe, expect, it } from "vitest";
import { buildPerformancePersonnelDirectory } from "./personnel";
import { calculateAdvisorTargets, resolvePerformanceGoal, validateApprovedPerformanceGoal, type PerformanceGoal } from "./performance-goals";

const staff = buildPerformancePersonnelDirectory([{ id: 1, name: "Advisor", businessUnitId: 2, active: true, isManagedTech: true }], [{ id: 2, name: "HVAC - Sales", active: true }]).staff[0]!;
const goal: PerformanceGoal = { technicianId: "1", technician: "Advisor", month: "2026-11", report_department: "HVAC Sales", approval_status: "ACTIVE", source_note: "Approved", monthly_sales_goal: 15000, target_opportunities_monthly: 75, target_rate: 0.46, target_average: 1500, membership_monthly_goal: null, review_monthly_goal: null, working_days: null };
const history = Array.from({ length: 10 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, "0")}`, sales: 10000, opportunities: 25, closedOpportunities: 10, employed: true, complete: true }));

describe("central performance goals", () => {
  it("keeps 75 opportunities while unavailable targets remain pending", () => {
    expect(resolvePerformanceGoal(staff, "2026-11")).toMatchObject({ approval_status: "UPDATED_GOAL_PENDING", target_opportunities_monthly: 75, monthly_sales_goal: null });
    expect(resolvePerformanceGoal(staff, "2026-10").target_opportunities_monthly).toBeNull();
  });
  it("never carries an approved goal across months, employees or departments", () => {
    expect(resolvePerformanceGoal(staff, "2026-11", { ...goal, month: "2026-10" }).monthly_sales_goal).toBeNull();
    expect(resolvePerformanceGoal(staff, "2026-11", { ...goal, technicianId: "2" }).monthly_sales_goal).toBeNull();
    expect(resolvePerformanceGoal(staff, "2026-11", { ...goal, report_department: "Plumbing Service" }).monthly_sales_goal).toBeNull();
    expect(resolvePerformanceGoal(staff, "2026-11", goal).monthly_sales_goal).toBe(15000);
  });
  it("rejects invalid rates and unknown numeric targets rather than accepting NaN or zero working days", () => {
    expect(() => validateApprovedPerformanceGoal({ ...goal, target_rate: 1.01 })).toThrow();
    expect(() => validateApprovedPerformanceGoal({ ...goal, monthly_sales_goal: Number.NaN })).toThrow();
    expect(() => validateApprovedPerformanceGoal({ ...goal, working_days: 0 })).toThrow();
    expect(() => validateApprovedPerformanceGoal(goal)).not.toThrow();
  });
  it("calculates the approved ten-month rule with relative close-rate growth", () => {
    expect(calculateAdvisorTargets("2026-11", history)).toMatchObject({ monthlySalesGoal: 15000, targetAverage: 1500, targetRate: 0.46, targetOpportunitiesMonthly: 75, historyMonths: 10 });
  });
  it("weights close rate and average sale by the underlying opportunities", () => {
    const result = calculateAdvisorTargets("2026-11", history.map((row, i) => ({ ...row, sales: i ? 1000 : 100000, opportunities: i ? 10 : 100, closedOpportunities: i ? 1 : 50 })));
    expect(result.targetAverage).toBe(Math.round(109000 / 59 * 1.5 * 100) / 100);
    expect(result.targetRate).toBeCloseTo(59 / 190 * 1.15);
    expect(result.salesGoalDifference).not.toBe(0);
  });
  it("accounts for all source months and rejects a partial or repeated history", () => {
    expect(() => calculateAdvisorTargets("2026-11", history.slice(1))).toThrow(/ten/);
    expect(() => calculateAdvisorTargets("2026-11", history.map(() => history[0]!))).toThrow(/ten/);
    expect(() => calculateAdvisorTargets("2026-11", history.map((row, i) => ({ ...row, complete: i !== 3 })))).toThrow(/ten/);
  });
});
