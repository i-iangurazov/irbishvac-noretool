import { describe, expect, it } from "vitest";
import {
  buildCoachingFocus,
  buildPerformanceRoster,
  normalizePerformanceIdentity,
  type PerformanceActual,
  type PerformancePlan,
} from "./performance-data";

function actual(overrides: Partial<PerformanceActual> = {}): PerformanceActual {
  return {
    name: "Ivan Avila Oliveira",
    sourceKind: "technician",
    technicianId: "st-123",
    businessUnit: "HVAC Service",
    revenue: 20000,
    opportunities: 18,
    closedOpportunities: 9,
    rate: 0.5,
    averageSale: 1400,
    membershipsSold: 4,
    snapshotTime: "2026-07-21T12:00:00.000Z",
    ...overrides
  };
}

describe("performance data", () => {
  it("matches approved aliases instead of relying on exact display names", () => {
    const roster = buildPerformanceRoster([actual()], "2026-07-21");
    const ivan = roster.find((row) => row.slug === "ivan-avila");

    expect(ivan?.actual?.technicianId).toBe("st-123");
    expect(normalizePerformanceIdentity("Le’Jhavani De La Cruz-Robello")).toBe(
      normalizePerformanceIdentity("Le'Jhavani De La Cruz Robello"),
    );
  });

  it("keeps missing goals distinct from zero and sorts them into the review queue", () => {
    const roster = buildPerformanceRoster([], "2026-07-21");
    const bahruz = roster.find((row) => row.slug === "bahruz-brian-rasulov");

    expect(bahruz?.monthlySalesGoal).toBeNull();
    expect(bahruz?.status).toBe("missing-goal");
  });

  it("selects a measurable rate focus when rate is the weakest dial", () => {
    const roster = buildPerformanceRoster(
      [
        actual({
          name: "Jonathan Camargo",
          opportunities: 26,
          rate: 0.3,
          averageSale: 2300
        })
      ],
      "2026-07-31",
    );
    const jonathan = roster.find((row) => row.slug === "jonathan-camargo");

    expect(jonathan).toBeDefined();
    expect(buildCoachingFocus(jonathan!).title).toContain("conversion rate");
    expect(buildCoachingFocus(jonathan!).impact).toBeGreaterThan(0);
  });

  it("paces August goals against the 26 working days supplied by Tim", () => {
    const plan: PerformancePlan = {
      slug: "test-tech",
      month: "2026-08",
      approvalStatus: "ACTIVE",
      department: "HVAC Service",
      technician: "Test Tech",
      aliases: [],
      sourceKind: "technician",
      monthlySalesGoal: 26000,
      targetOpportunitiesMonthly: 78,
      targetRate: 0.6,
      targetRateType: "close",
      targetAverage: 1000,
      turnoverQuota: null,
      membershipMonthlyGoal: 10,
      reviewMonthlyGoal: 20,
      workingDaysMonthly: 26,
    };
    const [row] = buildPerformanceRoster(
      [actual({ name: "Test Tech", revenue: 4000, opportunities: 12 })],
      "2026-08-05",
      [plan],
    );

    expect(row?.expectedRevenue).toBe(4000);
    expect(row?.expectedOpportunities).toBe(12);
    expect(row?.pace).toBe(1);
  });
});
