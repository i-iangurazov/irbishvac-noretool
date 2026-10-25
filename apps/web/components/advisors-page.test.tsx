import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import AdvisorsPage from "../app/advisors/page";
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
  resolveDashboardFilters: async () => ({ apiQueryString: "preset=mtd" }),
}));
vi.mock("./leaderboard-page", () => ({
  LeaderboardPage: () => null,
  compactMoney: String,
  ratio: String,
}));
beforeEach(() => vi.stubGlobal("React", React));
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
  });
});
