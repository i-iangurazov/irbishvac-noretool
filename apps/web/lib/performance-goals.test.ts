import { describe, expect, it } from "vitest";
import { getTvPerformanceGoal } from "./performance-goals";

describe("getTvPerformanceGoal", () => {
  it("uses Vadim's latest explicit August target for Ivan Avila", () => {
    expect(getTvPerformanceGoal("Ivan Avila")).toMatchObject({
      monthlySalesGoal: 44_880,
      targetOpportunitiesMonthly: 40,
      targetRate: 0.87,
      targetAverage: 1_122,
    });
  });
});
