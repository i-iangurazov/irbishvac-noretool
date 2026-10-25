import type { CampaignRow } from "../components/campaign-performance-page";
import { rowCategory } from "./campaign-overview";
export type RevenueMetric = "completedRevenue" | "soldAmount";
export type RevenueFilter = "all" | "paid" | "organic";
export function revenueGroup(row: CampaignRow) {
  const category = rowCategory(row);
  return category === "organic" || category === "automation"
    ? "organic"
    : category === "paid" || category === "separate-spend"
      ? category
      : "other";
}
export const revenueLabels = {
  paid: "Paid Channels",
  organic: "Organic",
  other: "Unmapped",
  "separate-spend": "Branding/ATL",
};
export function filterRevenueRows(rows: CampaignRow[], filter: RevenueFilter) {
  return rows.filter((row) => filter === "all" || revenueGroup(row) === filter);
}
// Use matched channel cohorts and media spend, never precomputed all-in ROAS.
// A zero spend is not evidence of free acquisition for an active paid channel.
export function advertisingReturns(rows: CampaignRow[], metric: RevenueMetric) {
  const paid = rows.filter((row) => revenueGroup(row) === "paid");
  const covered = paid.filter((row) => row.actual.spend > 0);
  const missing = paid.filter(
    (row) =>
      row.actual.spend <= 0 &&
      (row.actual.qualifiedLeads > 0 ||
        row.actual.bookedJobs > 0 ||
        row.actual.soldJobs > 0 ||
        row.actual.soldAmount !== 0 ||
        row.actual.completedRevenue !== 0),
  );
  const spend = covered.reduce((sum, row) => sum + row.actual.spend, 0);
  const income = covered.reduce((sum, row) => sum + row.actual[metric], 0);
  return {
    spend,
    income,
    missing: missing.map((row) => row.channel),
    returnOnSpend: spend > 0 ? income / spend : null,
    expenseRatio: spend > 0 && income > 0 ? spend / income : null,
  };
}
export function sortRevenueRows(
  rows: CampaignRow[],
  metric: RevenueMetric,
  sort: string,
) {
  const value = (row: CampaignRow) =>
    sort === "value"
      ? row.actual[metric]
      : sort === "ratio"
        ? advertisingReturns([row], metric).expenseRatio
        : advertisingReturns([row], metric).returnOnSpend;
  return [...rows].sort((a, b) => {
    const av = value(a),
      bv = value(b);
    if (av == null) return bv == null ? a.channel.localeCompare(b.channel) : 1;
    if (bv == null) return -1;
    return (
      (sort === "ratio" ? av - bv : bv - av) ||
      a.channel.localeCompare(b.channel)
    );
  });
}
