import { pickFirst, resolveTabularReport, sumBy, toNumber, toRatio, weightedAverage } from "../shared/report";

export type AdvisorMetricRow = {
  name: string;
  totalSales: number;
  closedAverageSale: number;
  closedOpportunitiesCount: number;
  closeRateRolling: number;
  salesOpportunitiesCount: number;
  rankBySales?: number;
};

export type AdvisorDashboard = {
  rows: AdvisorMetricRow[];
  rowsRanked: AdvisorMetricRow[];
  totals: {
    totalSales: number;
    totalOpportunities: number;
    totalClosedOpportunities: number;
    weightedCloseRate: number;
    weightedClosedAverageSale: number;
  };
  snapshotTime: string | null;
};

export function buildAdvisorDashboard(input: unknown): AdvisorDashboard {
  const report = resolveTabularReport(input);

  const rows = report.rows
    .map((row) => {
      const totalSales = toNumber(row.TotalSales);
      const upstreamClosedAverageSale = toNumber(row.ClosedAverageSale);
      const explicitClosedOpportunities = toNumber(
        pickFirst(row, [
          "ClosedOpportunities",
          "Closed Opportunities",
          "ClosedOpportunity",
          "Closed Opportunity",
          "ClosedJobs",
          "Closed Jobs",
          "SoldJobs",
          "Sold Jobs"
        ]),
      );
      const closedOpportunitiesCount =
        explicitClosedOpportunities > 0
          ? explicitClosedOpportunities
          : upstreamClosedAverageSale > 0
            ? totalSales / upstreamClosedAverageSale
            : 0;

      return {
        name: String(row.Name ?? ""),
        totalSales,
        closedAverageSale:
          closedOpportunitiesCount > 0 ? totalSales / closedOpportunitiesCount : 0,
        closedOpportunitiesCount,
        closeRateRolling: toRatio(row.CloseRateRolling),
        salesOpportunitiesCount: toNumber(row.SalesOpportunity)
      };
    })
    .filter(
      (row) =>
        row.name !== "" ||
        row.totalSales > 0 ||
        row.closedAverageSale > 0 ||
        row.closedOpportunitiesCount > 0 ||
        row.salesOpportunitiesCount > 0,
    );

  const totalSales = sumBy(rows, (row) => row.totalSales);
  const totalClosedOpportunities = sumBy(rows, (row) => row.closedOpportunitiesCount);

  const rowsRanked = rows
    .slice()
    .sort(
      (left, right) =>
        right.totalSales - left.totalSales || left.name.localeCompare(right.name),
    )
    .map((row, index) => ({ ...row, rankBySales: index + 1 }));

  return {
    rows,
    rowsRanked,
    totals: {
      totalSales,
      totalOpportunities: sumBy(rows, (row) => row.salesOpportunitiesCount),
      totalClosedOpportunities,
      weightedCloseRate: Number(
        weightedAverage(rows, (row) => row.closeRateRolling, (row) => row.salesOpportunitiesCount).toFixed(3),
      ),
      weightedClosedAverageSale: Number(
        (totalClosedOpportunities > 0 ? totalSales / totalClosedOpportunities : 0).toFixed(2),
      )
    },
    snapshotTime: report.snapshotTime
  };
}
