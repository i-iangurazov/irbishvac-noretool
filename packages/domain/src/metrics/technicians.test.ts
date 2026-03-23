import { describe, expect, it } from "vitest";
import { buildTechnicianDashboard } from "./technicians";

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
});
