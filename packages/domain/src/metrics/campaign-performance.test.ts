import { describe, expect, it } from "vitest";
import {
  buildCampaignPerformanceSnapshot,
  countWeekdays,
  inferCampaignBudgetType,
  inferCampaignCategory,
  normalizeCampaignChannel,
} from "./campaign-performance";

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
    expect(result.sources).toHaveLength(6);
    expect(result.spendCoverage).toMatchObject({ status: "complete", activePaidChannels: 1, trackedPaidChannels: 1 });
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

  it("withholds aggregate cost metrics when an active paid channel has no cost", () => {
    const result = buildCampaignPerformanceSnapshot({
      month: "2026-08",
      cutoff: "2026-08-10",
      generatedAt: "2026-08-10T13:00:00.000Z",
      callCenterValues: [
        ["Date Received", "Medium", "Lead Quality", "Stage", "Lead Source"],
        ["2026-08-05", "Call", "Good", "Booked", "Yelp"],
        ["2026-08-06", "Call", "Good", "Booked", "Direct Mail"],
      ],
      campaignSummary: {
        fields: [{ name: "Name" }, { name: "Cost" }],
        data: [["Yelp", 500]],
      },
      soldEstimates: {},
      revenueByCampaign: {},
      planRows: [
        { channel: "Yelp", qualifiedLeads: 10, bookedJobs: 5, spend: 1_000, soldAmount: null, completedRevenue: null },
        { channel: "Direct Mail", qualifiedLeads: 10, bookedJobs: 5, spend: 8_700, soldAmount: null, completedRevenue: null },
      ],
      connectedPlanRowCount: 0,
      companyRevenueGoal: 100_000,
      marketingBudgetRate: 0.07,
      qualifiedLeadGoal: 20,
      opportunityGoal: 10,
      targetBookingRate: 0.5,
      planStatus: "DRAFT MODEL",
      channelLeadGoalMethod: "Test",
      channelBudgetGoalStatus: "Test",
      sourceReportIds: { campaignSummary: "898", soldEstimates: "7148368", revenueByCampaign: "101394656" },
    });

    expect(result.spendCoverage).toMatchObject({
      status: "partial",
      activePaidChannels: 2,
      trackedPaidChannels: 1,
      missingPaidChannels: ["Direct Mail"],
      trackedPaidSpend: 500,
      trackedPaidLeads: 1,
      trackedPaidBookedJobs: 1,
      trackedPaidCompletedRevenue: 0,
      coveredCostPerLead: 500,
      coveredCostPerBookedJob: 500,
      coveredRoas: 0,
    });
    expect(result.actual.costPerLead).toBeNull();
    expect(result.actual.costPerBookedJob).toBeNull();
    expect(result.actual.roas).toBeNull();
    expect(result.pace.spendPace).toBeNull();
    expect(result.rows.find((row) => row.channel === "Direct Mail")?.budgetType).toBe("prepaid");
    expect(result.sources.find((source) => source.name === "Google Campaign Plan")).toMatchObject({ status: "blocked", rowCount: 0 });
  });

  it("uses the latest manual MTD cost override", () => {
    const result = buildCampaignPerformanceSnapshot({
      month: "2026-08",
      cutoff: "2026-08-10",
      callCenterValues: [
        ["Date Received", "Medium", "Lead Quality", "Stage", "Lead Source"],
        ["2026-08-05", "Call", "Good", "Booked", "Direct Mail"],
      ],
      campaignSummary: {},
      soldEstimates: {},
      revenueByCampaign: {},
      planRows: [{ channel: "Direct Mail", qualifiedLeads: 10, bookedJobs: 5, spend: 8_700, soldAmount: null, completedRevenue: null }],
      manualCostRows: [{ channel: "Direct Mail", spend: 8_700, budgetType: "prepaid" }],
      connectedCostRowCount: 1,
      companyRevenueGoal: 100_000,
      marketingBudgetRate: 0.07,
      qualifiedLeadGoal: 10,
      opportunityGoal: 5,
      targetBookingRate: 0.5,
      planStatus: "DRAFT MODEL",
      channelLeadGoalMethod: "Test",
      channelBudgetGoalStatus: "Test",
      sourceReportIds: { campaignSummary: "898", soldEstimates: "7148368", revenueByCampaign: "101394656" },
    });

    expect(result.actual.spend).toBe(8_700);
    expect(result.spendCoverage.status).toBe("complete");
    expect(result.sources.find((source) => source.name === "Google Campaign Costs")).toMatchObject({ status: "connected", rowCount: 1 });
    expect(inferCampaignBudgetType("Radio")).toBe("manual");
    expect(inferCampaignBudgetType("Direct Mail")).toBe("prepaid");
  });

  it("maps known ServiceTitan campaign names into executive channels", () => {
    expect(normalizeCampaignChannel("Google Ad Extension - Branded")).toBe("Google Ads");
    expect(normalizeCampaignChannel("Google LSA - HVAC")).toBe("Google Local Services");
    expect(normalizeCampaignChannel("Facebook - San Jose")).toBe("Facebook Ads");
    expect(normalizeCampaignChannel("Mail Shark August")).toBe("Direct Mail");
    expect(normalizeCampaignChannel("LettrLabs Plumbing")).toBe("Direct Mail");
    expect(normalizeCampaignChannel("Refer Pro")).toBe("Refer Pro");
    expect(normalizeCampaignChannel("Carrier Website")).toBe("3rd Party Websites");
    expect(normalizeCampaignChannel("Rheem Contractor Finder")).toBe("3rd Party Websites");
    expect(normalizeCampaignChannel("Switch Is On")).toBe("3rd Party Websites");
    expect(normalizeCampaignChannel("EnergySage")).toBe("3rd Party Websites");
    expect(normalizeCampaignChannel("CPAU")).toBe("3rd Party Websites");
    expect(normalizeCampaignChannel("Home Care Plan")).toBe("Home Care");
    expect(normalizeCampaignChannel("Email Marketing - August")).toBe("Email Marketing");
    expect(normalizeCampaignChannel("Billboard 101")).toBe("Billboard");
    expect(normalizeCampaignChannel("Appfolio")).toBe("Appfolio");
    expect(normalizeCampaignChannel("Diamond Certified")).toBe("Diamond Certified");
    expect(normalizeCampaignChannel("SMS - AC Recurring Service Reminder")).toBe("SMS Campaigns");
    expect(normalizeCampaignChannel("Reserve with Google")).toBe("Reserve with Google");
    expect(inferCampaignCategory("Website")).toBe("paid");
    expect(inferCampaignCategory("Refer Pro")).toBe("paid");
    expect(inferCampaignCategory("Radio")).toBe("separate-spend");
    expect(inferCampaignCategory("3rd Party Websites")).toBe("organic");
    expect(inferCampaignCategory("Hatch Campaigns")).toBe("automation");
    expect(inferCampaignCategory("SMS Campaigns")).toBe("retention");
    expect(inferCampaignCategory("Reserve with Google")).toBe("organic");
  });

  it("aggregates third-party website aliases without changing source totals", () => {
    const result = buildCampaignPerformanceSnapshot({
      month: "2026-08",
      cutoff: "2026-08-13",
      callCenterValues: [
        ["Date Received", "Medium", "Lead Quality", "Stage", "Lead Source"],
        ["2026-08-05", "Call", "Good", "Booked", "Carrier"],
        ["2026-08-06", "Call", "Good", "Booked", "EnergySage"],
      ],
      campaignSummary: {},
      soldEstimates: {
        fields: [{ name: "ParentJobCampaign" }, { name: "Total" }],
        data: [["Carrier", 1_250], ["Switch Is On", 2_750]],
      },
      revenueByCampaign: {
        fields: [{ name: "Name" }, { name: "CompletedRevenue" }],
        data: [["Rheem", 900], ["CPAU", 1_100]],
      },
      planRows: [],
      companyRevenueGoal: 100_000,
      marketingBudgetRate: 0.07,
      qualifiedLeadGoal: 100,
      opportunityGoal: 50,
      targetBookingRate: 0.5,
      planStatus: "DRAFT MODEL",
      channelLeadGoalMethod: "Test",
      channelBudgetGoalStatus: "Test",
      sourceReportIds: { campaignSummary: "898", soldEstimates: "7148368", revenueByCampaign: "101394656" },
    });

    const thirdParty = result.rows.find((row) => row.channel === "3rd Party Websites");
    expect(thirdParty?.category).toBe("organic");
    expect(thirdParty?.actual).toMatchObject({
      qualifiedLeads: 2,
      bookedJobs: 2,
      soldJobs: 2,
      soldAmount: 4_000,
      completedRevenue: 2_000,
    });
    expect(result.actual.soldAmount).toBe(4_000);
    expect(result.actual.completedRevenue).toBe(2_000);
  });

  it("retains unknown ServiceTitan campaigns so source totals reconcile", () => {
    const result = buildCampaignPerformanceSnapshot({
      month: "2026-08",
      cutoff: "2026-08-13",
      callCenterValues: [["Date Received", "Medium", "Lead Quality", "Stage", "Lead Source"]],
      campaignSummary: {},
      soldEstimates: {
        fields: [{ name: "ParentJobCampaign" }, { name: "Total" }],
        data: [["Future Campaign", 1_250]],
      },
      revenueByCampaign: {
        fields: [{ name: "Name" }, { name: "CompletedRevenue" }],
        data: [["Future Campaign", 900]],
      },
      planRows: [],
      companyRevenueGoal: 100_000,
      marketingBudgetRate: 0.07,
      qualifiedLeadGoal: 100,
      opportunityGoal: 50,
      targetBookingRate: 0.5,
      planStatus: "DRAFT MODEL",
      channelLeadGoalMethod: "Test",
      channelBudgetGoalStatus: "Test",
      sourceReportIds: { campaignSummary: "898", soldEstimates: "7148368", revenueByCampaign: "101394656" },
    });

    expect(result.actual.soldJobs).toBe(1);
    expect(result.actual.soldAmount).toBe(1_250);
    expect(result.actual.completedRevenue).toBe(900);
    expect(result.rows.find((row) => row.channel === "Other")?.actual).toMatchObject({
      soldJobs: 1,
      soldAmount: 1_250,
      completedRevenue: 900,
    });
  });
});
