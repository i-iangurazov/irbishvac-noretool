import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PerformanceDashboardPage } from "./performance-dashboard-page";
import { buildPerformanceRoster, type PerformancePlan } from "../lib/performance-data";

vi.mock("@irbis/ui", () => ({ DashboardShell: (props: { children: React.ReactNode; headerContent: React.ReactNode }) => <main>{props.headerContent}{props.children}</main> }));
vi.mock("../lib/api", () => ({ navItems: [] }));
vi.mock("../lib/assets", () => ({ getBrandLogoUrl: () => null, resolveStaffHeadshotUrl: () => null }));
vi.mock("./performance-staff-avatar", () => ({ PerformanceStaffAvatar: () => null }));
beforeEach(() => vi.stubGlobal("React", React));

describe("current coaching queue", () => {
  it("uses the selected month and department for goals, coverage and actual totals", () => {
    const base: PerformancePlan = { slug: "staff-1", technician: "Service hire", technicianId: "1", department: "HVAC Service", sourceKind: "technician", month: "2026-11", aliases: [], approvalStatus: "UPDATED_GOAL_PENDING", monthlySalesGoal: null, targetOpportunitiesMonthly: null, targetRate: null, targetRateType: "close", targetAverage: null, turnoverQuota: null, membershipMonthlyGoal: null };
    const roster = buildPerformanceRoster([{ name: "Sales colleague", technicianId: "2", sourceKind: "advisor", businessUnit: "HVAC Sales", revenue: 12000, opportunities: 5, closedOpportunities: 2, rate: .4, averageSale: 6000, membershipsSold: null, snapshotTime: "2026-11-03T08:30:00Z" }], "2026-11-02", [base, { ...base, slug: "staff-2", technicianId: "2", technician: "Sales colleague", department: "HVAC Sales", sourceKind: "advisor", approvalStatus: "ACTIVE", monthlySalesGoal: 30000 }]);
    const html = renderToStaticMarkup(<PerformanceDashboardPage cutoffDate="2026-11-02" roster={roster} searchParams={{ department: "HVAC Service" }} />);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.body.textContent).toContain("November 2026 goals");
    expect(doc.body.textContent).not.toContain("July 2026");
    const summary = doc.querySelector(".performance-summary")!;
    expect(summary.textContent).toContain("0 of 1 goals available");
    expect(summary.textContent).toContain("0 of 1 matched");
    expect(Array.from(summary.querySelectorAll("strong")).slice(0, 2).map(node => node.textContent)).toEqual(["—", "—"]);
    expect(doc.querySelector("tbody")?.textContent).toContain("Service hire");
    expect(doc.querySelector("tbody")?.textContent).not.toContain("Sales colleague");
    expect(html).not.toContain("Every report requires manager approval before delivery");
  });
});
