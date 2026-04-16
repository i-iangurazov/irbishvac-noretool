import { describe, expect, it } from "vitest";
import {
  buildBookingRateSummary,
  buildJobCostingSummary,
  buildMarketingDonut,
  buildRevenueGoalSummary,
  buildRevenueMonthlyPace,
  buildSalesMonthlyPace,
  buildSalesSummary,
  buildTrendingModel
} from "./company";

describe("company metrics", () => {
  it("groups marketing rows into the top 5 labels used by the Retool donut", () => {
    const result = buildMarketingDonut({
      fields: [{ name: "Name" }, { name: "CompletedRevenue" }],
      data: [
        ["A", 1000],
        ["B", 900],
        ["C", 800],
        ["D", 700],
        ["E", 600],
        ["F", 500]
      ]
    });

    expect(result.rows).toHaveLength(5);
    expect(result.rows.some((row) => row.groupKey === "Other")).toBe(false);
  });

  it("builds booking rate summary", () => {
    const result = buildBookingRateSummary({
      fields: [{ name: "LeadCalls" }, { name: "BookedJobsByCall" }],
      data: [
        [20, 10],
        [10, 5]
      ]
    });

    expect(result.kpis.rate).toBeCloseTo(0.5);
    expect(result.kpis.unbooked).toBe(15);
  });

  it("builds sales pace and sales summary", () => {
    const input = {
      fields: [
        { name: "Name" },
        { name: "TotalSales" },
        { name: "SalesOpportunity" },
        { name: "CloseRate" },
        { name: "ClosedAverageSale" },
        { name: "TotalRevenue" }
      ],
      data: [["BU1", 1000, 10, 0.5, 400, 1200]]
    };

    expect(buildSalesMonthlyPace(input, { daysInMonth: 30, businessDayOfMonth: 15 }).pace).toBe(2000);
    expect(buildSalesMonthlyPace(input, { daysInMonth: 30, businessDayOfMonth: 15 }).fromDay).toBe(1);
    expect(buildSalesSummary(input).totals.totalRevenue).toBe(1200);
  });

  it("sums revenue monthly pace from the upstream current-monthly-pace field", () => {
    const result = buildRevenueMonthlyPace({
      fields: [{ name: "Current Monthly Pace" }, { name: "Completed Revenue" }],
      data: [
        [22589.21, 10000],
        [30000, 20000]
      ]
    });

    expect(result.value).toBe(52589.21);
    expect(result.completedRevenueToDate).toBe(30000);
    expect(result.source).toBe("upstream-current-monthly-pace");
    expect(result.sourceField).toBe("Current Monthly Pace");
    expect(result.completedRevenueField).toBe("Completed Revenue");
  });

  it("prefers direct gross-margin fields and preserves negative values", () => {
    const result = buildJobCostingSummary(
      {
        fields: [{ name: "Gross Profit" }],
        data: [[-2500], [4000]]
      },
      10_000,
    );

    expect(result.mtd).toBe(1500);
    expect(result.remainingToGoal).toBe(8500);
    expect(result.percentToGoal).toBe(0.15);
    expect(result.source).toBe("gross-margin-field");
    expect(result.sourceField).toBe("Gross Profit");
  });

  it("falls back to revenue minus costs minus labor for gross margin when needed", () => {
    const result = buildJobCostingSummary(
      {
        fields: [
          { name: "Total" },
          { name: "Total Costs" },
          { name: "Labor Pay" }
        ],
        data: [
          [100_000, 60_000, 5_000],
          [50_000, 25_000, 2_500]
        ]
      },
      50_000,
    );

    expect(result.mtd).toBe(57_500);
    expect(result.remainingToGoal).toBe(-7500);
    expect(result.percentToGoal).toBe(1.15);
    expect(result.source).toBe("revenue-minus-costs");
    expect(result.sourceField).toBeNull();
  });

  it("builds goal summary and trending model", () => {
    const goals = buildRevenueGoalSummary({
      fields: [
        { name: "Name" },
        { name: "TotalRevenue" },
        { name: "TotalSales" },
        { name: "GoalDaily" },
        { name: "GoalNoWeekends" },
        { name: "CurrentYearlyPace" },
        { name: "CurrentMonthlyPace" }
      ],
      data: [["Company", 50000, 10000, 4000, 5000, 720000, 60000]]
    });

    expect(goals.totals.yearlyGoal).toBe(60000);

    const trending = buildTrendingModel(
      {
        fields: [
          { name: "Year" },
          { name: "Period" },
          { name: "TotalSales" },
          { name: "TotalRevenue" }
        ],
        data: [
          [2025, "Jan", 1000, 2000],
          [2026, "Jan", 1500, 2500]
        ]
      },
      [{ monthName: "January", goalAmount: 3000 }],
      { currentYear: 2026 },
    );

    expect(trending.months[0]?.goal).toBe(3000);
    expect(trending.years.previous).toBe(2025);
    expect(trending.years.current).toBe(2026);
    expect(trending.months[0]?.current.sales).toBe(1500);
  });
});
