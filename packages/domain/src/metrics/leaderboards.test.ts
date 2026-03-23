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
        { name: "SalesOpportunity" }
      ],
      data: [
        ["Advisor A", 1500, 400, 0.5, 3],
        ["Advisor B", 900, 300, 0.4, 2]
      ]
    });

    expect(result.rowsRanked[0]?.name).toBe("Advisor A");
    expect(result.totals.totalOpportunities).toBe(5);
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
