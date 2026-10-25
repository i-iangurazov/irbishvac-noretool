import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import AdvisorsPage from "../app/advisors/page";
const period = vi.hoisted(() => ({ preset: "mtd" }));
vi.mock("../lib/staff-portraits", () => ({
  preparedStaffPortraitUrls: async () =>
    new Map([
      ["Luis Retes", "/api/staff/portraits/luis-retes?v=test"],
      ["Angelo Gamez", "/api/staff/portraits/angelo-gamez?v=test"],
    ]),
}));
vi.mock("../lib/api", () => ({
  fetchApi: async () => ({
    rowsRanked: [
      "Raymond Porras",
      "Luis Retes",
      "Angelo Gamez",
      "Unlisted Future Hire",
    ].map((name) => ({
      name,
      totalSales: 0,
      closedAverageSale: 0,
      closedOpportunitiesCount: 0,
      closeRateRolling: 0,
      salesOpportunitiesCount: 0,
    })),
    totals: {
      totalSales: 0,
      totalOpportunities: 0,
      totalClosedOpportunities: 0,
      weightedCloseRate: 0,
      weightedClosedAverageSale: 0,
    },
    snapshotTime: null,
  }),
}));
vi.mock("../lib/dashboard-filters", () => ({
  resolveDashboardFilters: async () => ({
    apiQueryString: `preset=${period.preset}`,
    preset: period.preset,
    customRange: false,
  }),
}));
vi.mock("../lib/performance-goals", () => ({
  getTvPerformanceGoal: () => ({
    monthlySalesGoal: 100,
    targetOpportunitiesMonthly: 10,
  }),
}));
vi.mock("./leaderboard-page", () => ({
  LeaderboardPage: () => null,
  compactMoney: String,
  ratio: String,
}));
beforeEach(() => {
  period.preset = "mtd";
  vi.stubGlobal("React", React);
});
afterEach(() => vi.unstubAllGlobals());
describe("sales board roster", () => {
  it("renders every API-provided person without a name allowlist or positive-sales requirement", async () => {
    const page = await AdvisorsPage({});
    expect(page.props.title).toBe("HVAC Sales");
    expect(
      page.props.items.map((item: { title: string }) => item.title),
    ).toEqual([
      "Raymond Porras",
      "Luis Retes",
      "Angelo Gamez",
      "Unlisted Future Hire",
    ]);
    expect(
      page.props.items.find(
        (item: { title: string }) => item.title === "Luis Retes",
      ).imageUrl,
    ).toBe("/api/staff/portraits/luis-retes?v=test");
    expect(
      page.props.items.find(
        (item: { title: string }) => item.title === "Angelo Gamez",
      ).imageUrl,
    ).toBe("/api/staff/portraits/angelo-gamez?v=test");
  });
  it("does not compare annual opportunity counts with a monthly target", async () => {
    period.preset = "ytd";
    const page = await AdvisorsPage({});
    expect(
      page.props.items[0].stats.find(
        (stat: { label: string }) => stat.label === "Opportunities",
      )?.value,
    ).toBe("0");
    expect(
      page.props.items[0].stats.some(
        (stat: { label: string }) => stat.label === "Monthly Sales Goal",
      ),
    ).toBe(true);
  });
  it("keeps the monthly opportunity target on the monthly board", async () => {
    const page = await AdvisorsPage({});
    expect(
      page.props.items[0].stats.find(
        (stat: { label: string }) => stat.label === "Opps / Goal",
      )?.value,
    ).toBe("0 / 10");
  });
});
