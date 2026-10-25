import type {
  CampaignPerformanceData,
  CampaignRow,
} from "../components/campaign-performance-page";
import { rowCategory, totalCommissionCost } from "./campaign-overview";

export type RevenueMetric = "completedRevenue" | "soldAmount";
export type RevenueFilter = "all" | "paid" | "organic";
export type RevenueSort = "value" | "return" | "ratio";
export const revenueLabels = {
  paid: "Paid Channels",
  organic: "Organic",
  other: "Unmapped",
  "separate-spend": "Branding / ATL",
};
export function revenueGroup(row: CampaignRow) {
  const category = rowCategory(row);
  return category === "organic" || category === "automation"
    ? "organic"
    : category === "paid" || category === "separate-spend"
      ? category
      : "other";
}
export function filterRevenueRows(rows: CampaignRow[], filter: RevenueFilter) {
  return rows.filter((row) => filter === "all" || revenueGroup(row) === filter);
}
export function missingRevenueSpend(row: CampaignRow) {
  return (
    revenueGroup(row) === "paid" &&
    row.actual.spend <= 0 &&
    (row.actual.qualifiedLeads > 0 ||
      row.actual.bookedJobs > 0 ||
      row.actual.soldJobs > 0 ||
      row.actual.soldAmount !== 0 ||
      row.actual.completedRevenue !== 0)
  );
}
// Advertising returns use media spend only, never the precomputed all-in ROAS.
// Missing spend excludes the same channels from numerator and denominator.
export function advertisingReturns(rows: CampaignRow[], metric: RevenueMetric) {
  const paid = rows.filter((row) => revenueGroup(row) === "paid");
  const covered = paid.filter((row) => row.actual.spend > 0);
  const spend = covered.reduce((sum, row) => sum + row.actual.spend, 0);
  const income = covered.reduce((sum, row) => sum + row.actual[metric], 0);
  return {
    spend,
    income,
    missing: paid.filter(missingRevenueSpend).map((row) => row.channel),
    returnOnSpend: spend > 0 ? income / spend : null,
    expenseRatio: spend > 0 && income > 0 ? spend / income : null,
  };
}
export function marketingExpenses(
  data: CampaignPerformanceData,
  metric: RevenueMetric,
) {
  const paid = data.rows
    .filter((row) => revenueGroup(row) === "paid")
    .reduce((sum, row) => sum + row.actual.spend, 0);
  const branding = data.rows
    .filter((row) => revenueGroup(row) === "separate-spend")
    .reduce((sum, row) => sum + row.actual.spend, 0);
  return {
    paid,
    branding,
    total: data.actual.spend,
    other: data.actual.spend - paid - branding,
    commission: totalCommissionCost(data),
    ratio:
      data.actual[metric] > 0 ? data.actual.spend / data.actual[metric] : null,
  };
}
export function sortRevenueRows(
  rows: CampaignRow[],
  metric: RevenueMetric,
  sort: RevenueSort,
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
export type DistributionItem = { name: string; value: number };
export function revenueDistribution(
  data: CampaignPerformanceData,
  metric: RevenueMetric,
  grouping: "channel" | "department",
): DistributionItem[] | null {
  const departments =
    metric === "completedRevenue"
      ? data.revenueByDepartment?.map((row) => ({
          name: row.department,
          value: row.completedRevenue,
        }))
      : data.salesByDepartment?.map((row) => ({
          name: row.department,
          value: row.soldAmount,
        }));
  if (grouping === "department" && !departments?.length) return null;
  const items =
    grouping === "department"
      ? departments!
      : data.rows.map((row) => ({
          name: row.channel,
          value: row.actual[metric],
        }));
  const difference =
    Math.round(
      (data.actual[metric] - items.reduce((sum, row) => sum + row.value, 0)) *
        100,
    ) / 100;
  const reconciled = [...items];
  if (Math.abs(difference) > 0.01) {
    const existing = reconciled.find(
      (row) => row.name === "Reporting reconciliation",
    );
    if (existing) existing.value += difference;
    else
      reconciled.push({ name: "Reporting reconciliation", value: difference });
  }
  return reconciled
    .filter((row) => row.value !== 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}
