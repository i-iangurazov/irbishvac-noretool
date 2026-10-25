import { describe, expect, it } from "vitest";
import {
  buildAdvisorDashboard,
  mergeAdvisorRoster,
  filterAdvisorDashboardByDepartment,
  selectAdvisorRoster,
} from "./advisors";
describe("automatic sales roster", () => {
  it("uses active configured BU membership, including an unknown future hire with zero report activity", () => {
    const roster = selectAdvisorRoster(
      [
        { id: 1, name: "New Hire", active: true, businessUnitId: 1812 },
        { id: 2, name: "Inactive", active: false, businessUnitId: 1812 },
        { id: 3, name: "Other Department", active: true, businessUnitId: 10 },
        { id: 4, name: "Inactive BU", active: true, businessUnitId: 9 },
        { id: 5, name: "Electrical Seller", active: true, businessUnitId: 10 },
      ],
      [
        { id: 1812, name: "HVAC - Sales", active: true },
        { id: 9, active: false },
        { id: 10, name: "Electrical - Sales", active: true },
      ],
      [1812, 10],
    );
    expect(roster).toEqual([
      { technicianId: "1", name: "New Hire", businessUnit: "HVAC - Sales" },
    ]);
    const source = buildAdvisorDashboard([]);
    expect(mergeAdvisorRoster(source, roster).rowsRanked[0]).toMatchObject({
      name: "New Hire",
      totalSales: 0,
      rankBySales: 1,
    });
  });
  it("does not show another trade's sellers from a broad source report or an older roster cache", () => {
    const report = buildAdvisorDashboard([
      {
        Name: "HVAC Seller",
        TechnicianBusinessUnit: "HVAC - Sales",
        TotalSales: 100,
      },
      {
        Name: "Plumbing Seller",
        TechnicianBusinessUnit: "Plumbing - Sales",
        TotalSales: 200,
      },
    ]);
    const hvac = filterAdvisorDashboardByDepartment(
      report,
      "hvac-comfort-advisor",
    );
    const result = mergeAdvisorRoster(hvac, [
      {
        technicianId: "99",
        name: "Electrical Seller",
        businessUnit: "Electrical - Sales",
      },
    ]);
    expect(result.rows.map((row) => row.name)).toEqual(["HVAC Seller"]);
    expect(result.totals.totalSales).toBe(100);
    expect(report.totals.totalSales).toBe(300);
  });
  it("keeps actual historical metrics and joins by ID without counting a renamed seller twice", () => {
    const source = buildAdvisorDashboard([
      {
        Name: "Old name",
        TechnicianId: 1,
        TotalSales: 200,
        ClosedAverageSale: 100,
        SalesOpportunity: 4,
        CloseRateRolling: 0.5,
      },
    ]);
    const merged = mergeAdvisorRoster(source, [
      { technicianId: "1", name: "New name", businessUnit: "HVAC - Sales" },
      { technicianId: "2", name: "New hire", businessUnit: "HVAC - Sales" },
    ]);
    expect(merged.rows).toHaveLength(2);
    expect(merged.totals).toEqual(source.totals);
    expect(merged.rowsRanked[0]).toMatchObject({
      name: "Old name",
      totalSales: 200,
    });
  });
});
