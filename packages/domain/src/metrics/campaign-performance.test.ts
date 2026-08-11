import { describe, expect, it } from "vitest";
import { buildCampaignPerformanceSnapshot } from "./campaign-performance";

describe("campaign performance snapshot", () => {
  it("joins Google call-center rows with ServiceTitan actuals and enforces the cutoff", () => {
    const result = buildCampaignPerformanceSnapshot({
      month: "2026-08",
      cutoff: "2026-08-06",
      generatedAt: "2026-08-06T13:00:00.000Z",
      callCenterValues: [
        ["", "", "", "Date Received", "", "", "Medium", "Lead Quality", "Stage", "", "", "", "", "Lead Source"],
        ["", "", "", "8/5/2026 1:15:00 AM", "", "", "Call", "Good", "Booked", "", "", "", "", "Yelp"],
        ["", "", "", "2026-08-06", "", "", "Text", "Mid", "Open", "", "", "", "", "Yelp"],
        ["", "", "", "2026-08-07", "", "", "Call", "Good", "Booked", "", "", "", "", "Yelp"]
      ],
      campaignSummary: {
        fields: [{ name: "Name" }, { name: "Cost" }, { name: "CompletedRevenue" }],
        data: [["Yelp", 500, 400]]
      },
      soldEstimates: {
        fields: [{ name: "ParentJobCampaign" }, { name: "Total" }],
        data: [["Yelp", 900]]
      },
      revenueByCampaign: {
        fields: [{ name: "Name" }, { name: "CompletedRevenue" }],
        data: [["Yelp", 600]]
      },
      planRows: [{ channel: "Yelp", qualifiedLeads: 10, bookedJobs: 5, spend: 1000, soldAmount: null, completedRevenue: 5000 }],
      companyRevenueGoal: 100_000,
      marketingBudgetRate: 0.07,
      qualifiedLeadGoal: 100,
      opportunityGoal: 50,
      targetBookingRate: 0.5,
      planStatus: "MODEL PLAN",
      channelLeadGoalMethod: "Test plan",
      channelBudgetGoalStatus: "Test budget",
      sourceReportIds: { campaignSummary: "898", soldEstimates: "7148368", revenueByCampaign: "101394656" }
    });

    expect(result.dataStatus).toBe("LIVE");
    expect(result.actual.qualifiedLeads).toBe(2);
    expect(result.actual.bookedJobs).toBe(1);
    expect(result.actual.spend).toBe(500);
    expect(result.actual.soldJobs).toBe(1);
    expect(result.actual.soldAmount).toBe(900);
    expect(result.actual.completedRevenue).toBe(600);
    expect(result.rows[0]?.actual.bookingRate).toBe(0.5);
    expect(result.rows[0]?.opportunityAttainment).toBe(0.2);
    expect(result.rows[0]?.pace).toBeCloseTo(31 / 30);
    expect(result.pace.opportunityPace).toBeCloseTo(31 / 300);
    expect(result.pace.opportunityGap).toBe(49);
    expect(result.sources).toHaveLength(4);
  });
});
