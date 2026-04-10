import { describe, expect, it } from "vitest";
import { buildAdvisorDashboard } from "./advisors";
import { buildCallCenterDashboard } from "./call-center";
import { buildCampaignDashboard } from "./campaigns";
import { buildLeadGenerationDashboard } from "./lead-generation";

describe("leaderboard metric families", () => {
  it("builds advisor rankings", () => {
    const result = buildAdvisorDashboard({
      fields: [
        { name: "Name" },
        { name: "TotalSales" },
        { name: "ClosedAverageSale" },
        { name: "CloseRateRolling" },
        { name: "SalesOpportunity" },
        { name: "ClosedOpportunities" }
      ],
      data: [
        ["Advisor A", 4500, 1500, 0.5, 6, 1],
        ["Advisor B", 3000, 1500, 0.4, 4, 2]
      ]
    });

    expect(result.rowsRanked[0]?.name).toBe("Advisor A");
    expect(result.rows.find((row) => row.name === "Advisor A")?.closedAverageSale).toBe(4500);
    expect(result.totals.totalOpportunities).toBe(10);
    expect(result.totals.totalClosedOpportunities).toBe(3);
    expect(result.totals.weightedClosedAverageSale).toBe(2500);
  });

  it("infers advisor closed opportunities from available aggregates and handles zero safely", () => {
    const result = buildAdvisorDashboard({
      fields: [
        { name: "Name" },
        { name: "TotalSales" },
        { name: "ClosedAverageSale" },
        { name: "CloseRateRolling" },
        { name: "SalesOpportunity" }
      ],
      data: [
        ["Advisor A", 6000, 2000, 0.5, 6],
        ["Advisor B", 0, 0, 0.4, 3]
      ]
    });

    expect(result.rows.find((row) => row.name === "Advisor A")?.closedOpportunitiesCount).toBe(3);
    expect(result.rows.find((row) => row.name === "Advisor B")?.closedOpportunitiesCount).toBe(0);
    expect(result.totals.totalClosedOpportunities).toBe(3);
    expect(result.totals.weightedClosedAverageSale).toBe(2000);
  });

  it("builds call-center summary rows", () => {
    const result = buildCallCenterDashboard({
      fields: [
        { name: "Name" },
        { name: "LeadCalls" },
        { name: "InboundCallsBooked" },
        { name: "ManualCallsBooked" },
        { name: "TotalJobsBooked" },
        { name: "CallBookingRate" },
        { name: "CanceledBeforeDispatch" },
        { name: "CancellationRate" }
      ],
      data: [["CSR One", 20, 10, 2, 12, 0.6, 3, 0.25]]
    });

    expect(result.summary.leadCalls).toBe(20);
    expect(result.summary.totalJobs).toBe(12);
    expect(result.summary.cancelledBeforeDispatch).toBe(3);
    expect(result.summary.cancellationRate).toBe(0.25);
    expect(result.rowsRanked[0]?.name).toBe("CSR One");
  });

  it("builds lead-generation rows", () => {
    const result = buildLeadGenerationDashboard({
      fields: [
        { name: "Name" },
        { name: "LeadGenerationOpportunity" },
        { name: "ReplacementOpportunity" },
        { name: "LeadsSet" },
        { name: "ReplacementLeadsSet" }
      ],
      data: [["Team Alpha", 10, 5, 3, 2]]
    });

    expect(result.rows[0]?.leadsGenerated).toBe(15);
    expect(result.rows[0]?.bookingRate).toBeCloseTo(5 / 15);
  });

  it("builds campaign rows with derived roi", () => {
    const result = buildCampaignDashboard({
      fields: [
        { name: "Name" },
        { name: "LeadCalls" },
        { name: "BookedJobsByCall" },
        { name: "Campaign Cost" },
        { name: "Completed Revenue" }
      ],
      data: [["Campaign X", 30, 8, 1000, 2500]]
    });

    expect(result.rowsRanked[0]?.leadCalls).toBe(30);
    expect(result.rowsRanked[0]?.roi).toBe(150);
  });
});
