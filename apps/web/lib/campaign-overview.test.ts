import { describe, expect, it } from "vitest";
import {
  bookingRateFor,
  campaignMonthIds,
  channelRoas,
  performanceSeries,
  topChannels,
} from "./campaign-overview";
import type {
  CampaignPerformanceData,
  CampaignRow,
} from "../components/campaign-performance-page";
import snapshot from "../data/campaign-performance-august.json";

function row(
  channel: string,
  category: CampaignRow["category"],
  revenue: number,
  sales: number,
  spend: number,
  leads = 10,
  booked = 5,
): CampaignRow {
  const base = (snapshot as CampaignPerformanceData).rows[0]!;
  return {
    ...base,
    channel,
    ...(category ? { category } : {}),
    actual: {
      ...base.actual,
      completedRevenue: revenue,
      soldAmount: sales,
      spend,
      commissionCost: 0,
      totalCost: spend,
      qualifiedLeads: leads,
      bookedJobs: booked,
    },
  };
}

describe("marketing overview", () => {
  it("ranks three channels within each group and re-ranks sales and ROAS without mutating data", () => {
    const rows = [
      row("A", "paid", 100, 900, 50),
      row("B", "paid", 300, 400, 100),
      row("C", "paid", 200, 300, 10),
      row("D", "paid", 400, 200, 0),
      row("Organic", "organic", 9000, 9000, 0),
    ];
    expect(
      topChannels(rows, "paid", "completedRevenue").map((r) => r.channel),
    ).toEqual(["D", "B", "C"]);
    expect(
      topChannels(rows, "paid", "soldAmount").map((r) => r.channel),
    ).toEqual(["A", "B", "C"]);
    expect(topChannels(rows, "paid", "roas").map((r) => r.channel)).toEqual([
      "C",
      "B",
      "A",
    ]);
    expect(channelRoas(rows[3]!)).toBeNull();
    expect(channelRoas(rows[4]!)).toBeNull();
    expect(rows[0]?.channel).toBe("A");
  });
  it("uses weighted bookings and keeps true zero separate from no leads", () => {
    expect(
      bookingRateFor([
        row("A", "paid", 0, 0, 0, 100, 10),
        row("B", "paid", 0, 0, 0, 10, 9),
      ]),
    ).toBeCloseTo(19 / 110);
    expect(bookingRateFor([row("A", "paid", 0, 0, 0, 10, 0)])).toBe(0);
    expect(bookingRateFor([])).toBeNull();
  });
  it("preserves month cutoffs and missing bookings while excluding unrelated groups", () => {
    const data = {
      ...(snapshot as CampaignPerformanceData),
      rows: [
        row("A", "paid", 100, 0, 10),
        row("B", "organic", 200, 0, 0),
        row("C", "automation", 999, 0, 0),
      ],
    };
    expect(performanceSeries([data], "completedRevenue")[0]).toMatchObject({
      paid: 100,
      organic: 200,
      cutoff: data.period.to,
    });
    expect(
      performanceSeries(
        [{ ...data, leadDataStatus: "unavailable" }],
        "bookedJobs",
      )[0],
    ).toMatchObject({ paid: null, organic: null });
  });
  it("includes intervening months and requested historical months across year boundaries", () => {
    expect(
      campaignMonthIds("2027-01", "2026-05", ["2026-07", "2026-08"]),
    ).toEqual([
      "2026-05",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
    expect(campaignMonthIds("2026-09", "2027-01", ["2026-07"])).not.toContain(
      "2027-01",
    );
  });
});
