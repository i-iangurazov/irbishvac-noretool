import { describe, it, expect } from "vitest";
import snapshot from "../data/campaign-performance-august.json";
import type {
  CampaignPerformanceData,
  CampaignRow,
} from "../components/campaign-performance-page";
import {
  advertisingReturns,
  filterRevenueRows,
  sortRevenueRows,
} from "./campaign-revenue";
const row = (
  channel: string,
  category: NonNullable<CampaignRow["category"]>,
  revenue: number,
  sales: number,
  spend: number,
): CampaignRow => ({
  ...(snapshot as CampaignPerformanceData).rows[0]!,
  channel,
  category,
  actual: {
    ...(snapshot as CampaignPerformanceData).rows[0]!.actual,
    completedRevenue: revenue,
    soldAmount: sales,
    spend,
    commissionCost: 1000,
    totalCost: spend + 1000,
  },
});
describe("Revenue & Sales metrics", () => {
  it("uses media spend, switches numerator, and matches covered cohorts", () => {
    const rows = [
      row("A", "paid", 1000, 3000, 100),
      row("Missing", "paid", 9000, 12000, 0),
      row("TV", "separate-spend", 5000, 7000, 500),
      row("Organic", "organic", 2000, 2000, 0),
    ];
    expect(advertisingReturns(rows, "completedRevenue")).toMatchObject({
      spend: 100,
      income: 1000,
      returnOnSpend: 10,
      expenseRatio: 0.1,
      missing: ["Missing"],
    });
    expect(advertisingReturns(rows, "soldAmount").returnOnSpend).toBe(30);
    expect(advertisingReturns(rows, "soldAmount").expenseRatio).toBeCloseTo(
      1 / 30,
    );
  });
  it("distinguishes zero return from undefined ratios", () => {
    expect(
      advertisingReturns([row("A", "paid", 0, 0, 100)], "completedRevenue"),
    ).toMatchObject({ returnOnSpend: 0, expenseRatio: null });
    expect(
      advertisingReturns([row("A", "paid", 0, 100, 0)], "soldAmount")
        .returnOnSpend,
    ).toBeNull();
    expect(advertisingReturns([], "soldAmount").expenseRatio).toBeNull();
  });
  it("filters consistently, preserves unmapped and ATL in all, and sorts nulls last", () => {
    const rows = [
      row("A", "paid", 100, 800, 100),
      row("B", "paid", 600, 200, 100),
      row("C", "automation", 1000, 1000, 0),
      row("D", "other", 1, 1, 0),
      row("TV", "separate-spend", 1, 1, 100),
    ];
    expect(filterRevenueRows(rows, "all")).toHaveLength(5);
    expect(filterRevenueRows(rows, "organic").map((r) => r.channel)).toEqual([
      "C",
    ]);
    expect(
      sortRevenueRows(rows, "soldAmount", "return")
        .slice(0, 2)
        .map((r) => r.channel),
    ).toEqual(["A", "B"]);
    expect(
      sortRevenueRows(rows, "completedRevenue", "ratio")
        .slice(0, 2)
        .map((r) => r.channel),
    ).toEqual(["B", "A"]);
    expect(rows[0]!.channel).toBe("A");
  });
});
