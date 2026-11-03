import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdvisorsPage from "../app/advisors/page";
import { FieldTechnicianBoardPage } from "./field-technician-board-page";
import { InstallerBoardPage } from "./installer-board-page";

const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));
vi.mock("../lib/api", () => ({ fetchApi }));
vi.mock("../lib/staff-portraits", () => ({ preparedStaffPortraitUrls: async () => new Map() }));
vi.mock("../lib/dashboard-filters", () => ({ resolveDashboardFilters: async () => ({ apiQueryString: "preset=mtd", preset: "mtd", customRange: false }) }));
vi.mock("../lib/performance-goals", () => ({ getTvPerformanceGoal: () => ({ monthlySalesGoal: 100, targetOpportunitiesMonthly: 75, targetRate: .5, targetAverage: 1000 }) }));
vi.mock("./leaderboard-page", () => ({ LeaderboardPage: () => null, money: String, compactMoney: String, ratio: String }));

const fixture = () => ({
  rowsRanked: [false, true].map(available => ({
    name: available ? "Verified zero activity" : "New hire without scorecard",
    actualSourceAvailable: available, businessUnit: "HVAC Service", position: null, photoUrl: null,
    totalInfluencedRevenue: 0, completedRevenue: 0, avgSaleFromOpps: 0, replacementLeadConvRate: 0,
    totalTechLeadSales: 0, totalSales: 0, membershipsSold: 0, closeRate: 0, salesOpportunity: 0,
    closedAverageSale: 0, closedOpportunitiesCount: 0, closeRateRolling: 0, salesOpportunitiesCount: 0,
    installedRevenue: 0, jobsCompleted: 0, recallsCaused: 0, billableEfficiency: 0, averageInstall: 0,
  })),
  totals: { totalSales: 0, totalOpportunities: 0, weightedCloseRate: 0, weightedClosedAverageSale: 0,
    totalInfluencedRevenue: 0, completedRevenue: 0, avgCloseRate: "0", avgMembershipConv: "0",
    installedRevenue: 0, jobsCompleted: 0, recallsCaused: 0, billableEfficiencyAvg: 0 },
  snapshotTime: "2026-11-03T08:30:00Z" as string | null,
});
beforeEach(() => { vi.stubGlobal("React", React); fetchApi.mockResolvedValue(fixture()); });

const boards = [
  { name: "technician", render: () => FieldTechnicianBoardPage({ path: "/technicians", apiPath: "technicians", title: "Technicians", subtitle: "" }) },
  { name: "advisor", render: () => AdvisorsPage({}) },
  { name: "installer", render: () => InstallerBoardPage({ path: "/installers", apiPath: "installers", title: "Installers", subtitle: "" }) },
];
describe.each(boards)("$name data availability", ({ render, name }) => {
  it("retains new hires, distinguishes missing data from verified zero and preserves approved goals", async () => {
    const page = await render();
    expect(page.props.items).toHaveLength(2);
    const [missing, zero] = page.props.items;
    expect(missing).toMatchObject({ title: "New hire without scorecard", value: "—", valueLabel: "Data unavailable" });
    expect(zero.value).toBe("0");
    if (name === "installer") expect(missing.stats.every((stat: { value: string }) => stat.value === "Unavailable")).toBe(true);
    else {
      expect(missing.stats.find((stat: { label: string }) => stat.label === "Close / Goal").value).toBe("Unavailable / 0.5");
      expect(missing.stats.find((stat: { label: string }) => stat.label === "Opps / Goal").value).toBe("Unavailable / 75");
      expect(zero.stats.find((stat: { label: string }) => stat.label === "Opps / Goal").value).toBe("0 / 75");
    }
  });
  it("does not present zero totals when the entire selected scope is missing", async () => {
    const data = fixture();
    data.snapshotTime = null;
    data.rowsRanked.forEach(row => { row.actualSourceAvailable = false; });
    fetchApi.mockResolvedValue(data);
    const page = await render();
    expect(page.props.kpis.every((kpi: { value: string }) => kpi.value === "Unavailable")).toBe(true);
  });
});
