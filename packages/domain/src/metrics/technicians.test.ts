import { describe, expect, it } from "vitest";
import {
  buildTechnicianDashboard,
  filterTechnicianDashboardByDepartment
} from "./technicians";

describe("buildTechnicianDashboard", () => {
  it("preserves weighted totals and ranking", () => {
    const result = buildTechnicianDashboard({
      fields: [
        { name: "Name" },
        { name: "TechnicianBusinessUnit" },
        { name: "CompletedRevenue" },
        { name: "TotalLeadSales" },
        { name: "SalesOpportunity" },
        { name: "ClosedOpportunities" },
        { name: "OpportunityAverageSale" },
        { name: "MembershipOpportunities" },
        { name: "MembershipsSold" },
        { name: "CloseRate" }
      ],
      data: [
        ["Alice", "Service", 1000, 200, 10, 5, 500, 4, 2, 0.5],
        ["Bob", "Service", 500, 50, 5, 2, 250, 2, 1, 0.4]
      ]
    });

    expect(result.rowsRanked[0]?.name).toBe("Alice");
    expect(result.totals.totalInfluencedRevenue).toBe(1750);
    expect(result.totals.avgCloseRate).toBe("0.467");
    expect(result.totals.avgMembershipConv).toBe("0.500");
  });

  it("separates service, plumbing, and electrical technicians from ST position or business unit", () => {
    const result = buildTechnicianDashboard({
      fields: [
        { name: "Name" },
        { name: "TechnicianBusinessUnit" },
        { name: "Position" },
        { name: "CompletedRevenue" },
        { name: "TotalLeadSales" },
        { name: "SalesOpportunity" },
        { name: "ClosedOpportunities" },
        { name: "OpportunityAverageSale" },
        { name: "MembershipOpportunities" },
        { name: "MembershipsSold" }
      ],
      data: [
        ["HVAC Tech", "HVAC - Service", "", 1000, 100, 10, 5, 500, 4, 2],
        ["Plumber", "Plumbing - Service", "", 2000, 200, 20, 10, 700, 6, 3],
        [
          "Electrician",
          "HVAC - Service",
          "Electrical Service Technicians",
          3000,
          300,
          30,
          15,
          900,
          8,
          4
        ],
        [
          "Advisor Position",
          "Plumbing - Service",
          "HVAC Comfort Advisors",
          4000,
          400,
          40,
          20,
          1100,
          10,
          5
        ]
      ]
    });

    expect(filterTechnicianDashboardByDepartment(result, "hvac-service").rowsRanked).toHaveLength(1);
    expect(filterTechnicianDashboardByDepartment(result, "plumbing").rowsRanked).toHaveLength(1);
    expect(filterTechnicianDashboardByDepartment(result, "plumbing").rowsRanked[0]?.name).toBe("Plumber");
    expect(filterTechnicianDashboardByDepartment(result, "electrical").rowsRanked[0]?.name).toBe("Electrician");
    expect(filterTechnicianDashboardByDepartment(result, "hvac-comfort-advisor").rowsRanked[0]?.name).toBe(
      "Advisor Position",
    );
  });
});
