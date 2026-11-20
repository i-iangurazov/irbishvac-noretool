import { describe, expect, it } from "vitest";
import { buildCampaignPerformanceSnapshot, normalizeCampaignChannel } from "./campaign-performance";

// Campaign names observed in report 898, rather than examples of bid-strategy keywords.
const affectedCampaigns = [
  "[Call] S || HVAC: [BIG] AC & HP & FUR (Install) || MaxClicks",
  "[Call] S || HVAC: Heat Pump (Install/Replace) || tSIS-75%",
  "[Call] S || HVAC: [BIG] AC & HP & FUR (Repair) || MaxClicks",
  "[Call] S || HVAC: AC (Install/Replace) || tSIS-75%",
  "[Call] S || HVAC: Furnace (Repair) || MaxClicks",
  "[Call] S || HVAC: Heat Pump (Repair) || CPC",
  "[Call] S || Plumbing: DSA || MaxClicks",
  "[Call] S || Water Heater: Install/Replace || MaxClicks",
  "S || (All) DSA || MaxClicks",
];

describe("reconciled Google Ads campaign classification", () => {
  it.each(affectedCampaigns)("recognizes the verified alias %s", (name) => {
    expect(normalizeCampaignChannel(name)).toBe("Google Ads");
    expect(normalizeCampaignChannel(`  ${name.toLowerCase().replaceAll(" ", "  ")}  `)).toBe("Google Ads");
  });

  it.each([
    "Unverified HVAC Campaign || MaxClicks",
    "Unverified Campaign || tSIS-75%",
    "Unverified Campaign || CPC",
    "[Call] S || Plumbing: DSA || MaxClicks - unverified copy",
  ])("keeps an unverified campaign in Other: %s", (name) => {
    expect(normalizeCampaignChannel(name)).toBe("Other");
  });

  it("joins the aliases across source reports without moving unrelated Other activity or changing totals", () => {
    const unknownCampaign = "Unverified Campaign || MaxClicks";
    const result = buildCampaignPerformanceSnapshot({
      month: "2026-10",
      cutoff: "2026-10-31",
      generatedAt: "2026-11-01T08:00:00.000Z",
      callCenterValues: [
        ["Date Received", "Medium", "Lead Quality", "Stage", "Lead Source"],
        ...affectedCampaigns.map((name) => ["2026-10-30", "Call", "Good", "Booked", name]),
        ["2026-10-30", "Call", "Good", "Booked", unknownCampaign],
      ],
      campaignSummary: {
        fields: [{ name: "Name" }, { name: "Cost" }],
        data: [...affectedCampaigns.map((name) => [name, 100]), ["Google Ads", 500], [unknownCampaign, 25]],
      },
      soldEstimates: {
        fields: [{ name: "ParentJobCampaign" }, { name: "Total" }],
        data: [...affectedCampaigns.map((name) => [name, 200]), [unknownCampaign, 50]],
      },
      revenueByCampaign: {
        fields: [{ name: "Name" }, { name: "CompletedRevenue" }],
        data: [...affectedCampaigns.map((name) => [name, 300]), [unknownCampaign, 75]],
      },
      commissionRows: [{ channel: "Google Ads", monthlyCommission: 100 }],
      planRows: [{ channel: "Google Ads", qualifiedLeads: 20, bookedJobs: 10, spend: 2_000, soldAmount: null, completedRevenue: null }],
      companyRevenueGoal: 100_000,
      marketingBudgetRate: 0.07,
      qualifiedLeadGoal: 20,
      opportunityGoal: 10,
      targetBookingRate: 0.5,
      planStatus: "MODEL PLAN",
      channelLeadGoalMethod: "Test",
      channelBudgetGoalStatus: "Test",
      sourceReportIds: { campaignSummary: "898", soldEstimates: "7148368", revenueByCampaign: "101394656" },
    });

    const google = result.rows.find((row) => row.channel === "Google Ads")!;
    const other = result.rows.find((row) => row.channel === "Other")!;
    expect(google.category).toBe("paid");
    expect(google.actual).toMatchObject({ spend: 1_400, commissionCost: 100, totalCost: 1_500, qualifiedLeads: 9, bookedJobs: 9, soldJobs: 9, soldAmount: 1_800, completedRevenue: 2_700 });
    expect(other.actual).toMatchObject({ spend: 25, qualifiedLeads: 1, bookedJobs: 1, soldJobs: 1, soldAmount: 50, completedRevenue: 75 });
    expect(result.actual).toMatchObject({ spend: 1_425, commissionCost: 100, totalCost: 1_525, qualifiedLeads: 10, bookedJobs: 10, soldJobs: 10, soldAmount: 1_850, completedRevenue: 2_775 });
    expect(google.plan.spend).toBe(2_000);
    expect(result.plan.marketingBudgetGoal).toBeCloseTo(7_000);
  });
});
