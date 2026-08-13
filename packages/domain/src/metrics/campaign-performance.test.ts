import { describe, expect, it } from "vitest";
import { buildCampaignPerformanceSnapshot, countWeekdays } from "./campaign-performance";

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
    expect(result.period.elapsedWorkingDays).toBe(4);
    expect(result.period.workingDaysInMonth).toBe(21);
    expect(result.rows[0]?.pace).toBeCloseTo(1.05);
    expect(result.pace.opportunityPace).toBeCloseTo(0.105);
    expect(result.pace.expectedCalendarDayRatio).toBeCloseTo(6 / 31);
    expect(result.pace.opportunityGap).toBe(49);
    expect(result.sources).toHaveLength(5);
    expect(result.nextMonthDraft.month).toBe("2026-09");
  });

  it("keeps original goals separate from a dated forecast revision", () => {
    const result = buildCampaignPerformanceSnapshot({
      month: "2026-08",
      cutoff: "2026-08-10",
      generatedAt: "2026-08-10T13:00:00.000Z",
      callCenterValues: [["Date Received", "Medium", "Lead Quality", "Stage", "Lead Source"]],
      campaignSummary: {},
      soldEstimates: {},
      revenueByCampaign: {},
      planRows: [{ channel: "Yelp", qualifiedLeads: 100, bookedJobs: 50, spend: 10_000, soldAmount: null, completedRevenue: 50_000 }],
      forecastRows: [{ channel: "Yelp", qualifiedLeads: 80, bookedJobs: 40, spend: 8_000, soldAmount: null, completedRevenue: 40_000, effectiveFrom: "2026-08-10", reason: "Budget rebalanced" }],
      capacityAssumptions: [{ team: "HVAC Service", headcount: 2, opportunitiesPerDay: 3, planningDays: 25 }],
      capacityStatus: "connected",
      planApproval: { approvalStatus: "approved", version: "2026-08-v1", approvedBy: "Tim", approvedAt: "2026-07-31" },
      companyRevenueGoal: 100_000,
      marketingBudgetRate: 0.07,
      qualifiedLeadGoal: 80,
      opportunityGoal: 40,
      targetBookingRate: 0.5,
      planStatus: "APPROVED PLAN",
      channelLeadGoalMethod: "Connected",
      channelBudgetGoalStatus: "Connected",
      sourceReportIds: { campaignSummary: "898", soldEstimates: "7148368", revenueByCampaign: "101394656" }
    });

    expect(result.rows[0]?.plan.bookedJobs).toBe(50);
    expect(result.rows[0]?.forecast?.bookedJobs).toBe(40);
    expect(result.rows[0]?.effectivePlan.bookedJobs).toBe(40);
    expect(result.plan.originalPlanLocked).toBe(true);
    expect(result.forecast).toMatchObject({ status: "active", effectiveFrom: "2026-08-10", changedChannelCount: 1 });
    expect(result.capacity.monthlyOpportunityCapacity).toBe(150);
  });

  it("counts weekdays for operational pace and excludes weekends", () => {
    expect(countWeekdays("2026-08-01", "2026-08-10")).toBe(6);
  });
});
