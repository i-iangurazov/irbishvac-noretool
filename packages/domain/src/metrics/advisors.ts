import { resolveTabularReport, sumBy, toNumber, toRatio, weightedAverage } from "../shared/report";

export type AdvisorMetricRow = {
  name: string;
  totalSales: number;
  closedAverageSale: number;
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
    weightedCloseRate: number;
    weightedClosedAverageSale: number;
  };
  snapshotTime: string | null;
};

export function buildAdvisorDashboard(input: unknown): AdvisorDashboard {
  const report = resolveTabularReport(input);

  const rows = report.rows
    .map((row) => ({
      name: String(row.Name ?? ""),
      totalSales: toNumber(row.TotalSales),
      closedAverageSale: toNumber(row.ClosedAverageSale),
      closeRateRolling: toRatio(row.CloseRateRolling),
      salesOpportunitiesCount: toNumber(row.SalesOpportunity)
    }))
    .filter(
      (row) =>
        row.name !== "" ||
        row.totalSales > 0 ||
        row.closedAverageSale > 0 ||
        row.salesOpportunitiesCount > 0,
    );

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
      totalSales: sumBy(rows, (row) => row.totalSales),
      totalOpportunities: sumBy(rows, (row) => row.salesOpportunitiesCount),
      weightedCloseRate: Number(
        weightedAverage(rows, (row) => row.closeRateRolling, (row) => row.salesOpportunitiesCount).toFixed(3),
      ),
      weightedClosedAverageSale: Number(
        weightedAverage(rows, (row) => row.closedAverageSale, (row) => row.salesOpportunitiesCount).toFixed(2),
      )
    },
    snapshotTime: report.snapshotTime
  };
}
