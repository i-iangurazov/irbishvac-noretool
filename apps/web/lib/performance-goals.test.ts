import { describe, expect, it } from "vitest";
import { getTvPerformanceGoal } from "./performance-goals";
describe("server performance goals", () => {
  it("does not substitute a historical employee target for missing goals", () => {
    expect(getTvPerformanceGoal(null)).toBeNull();
  });
  it("keeps known November opportunities and other pending fields separate", () => {
    expect(getTvPerformanceGoal({ approval_status: "UPDATED_GOAL_PENDING", monthly_sales_goal: null,
      target_opportunities_monthly: 75, target_rate: null, target_average: null,
      membership_monthly_goal: null, review_monthly_goal: null,
    })).toMatchObject({ targetOpportunitiesMonthly: 75, monthlySalesGoal: null, status: "UPDATED_GOAL_PENDING" });
  });
});
