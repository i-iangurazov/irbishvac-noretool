import { resolveTabularReport, sumBy, toNumber, toRatio, weightedAverage } from "../shared/report";

export type InstallerMetricRow = {
  name: string;
  installedRevenue: number;
  jobsCompleted: number;
  recallsCaused: number;
  billableEfficiency: number;
  averageInstall: number;
  installedRevenueFormatted: string;
  billableEfficiencyFormatted: string;
  averageInstallFormatted: string;
  rankByRevenue?: number;
};

export type InstallerDashboard = {
  rows: InstallerMetricRow[];
  rowsRanked: InstallerMetricRow[];
  totals: {
    jobsCompleted: number;
    recallsCaused: number;
    billableEfficiencyAvg: number;
    averageInstall: number;
    installedRevenue: number;
    leaderName: string | null;
    leaderRevenue: number;
  };
  snapshotTime: string | null;
};

export function buildInstallerDashboard(input: unknown): InstallerDashboard {
  const report = resolveTabularReport(input);

  const rows = report.rows.map((row) => {
    const installedRevenue = toNumber(
      row.CompletedRevenue ?? row.Revenue ?? row.InstalledRevenue ?? row.TotalRevenue,
    );
    const jobsCompleted = toNumber(
      row.CompletedJobs ?? row.ClosedOpportunities ?? row.JobsCompleted ?? row.Jobs,
    );
    const billableEfficiency = toRatio(
      row.BillableEfficiency ?? row.CloseRate ?? row.ClosePct ?? row.ConversionRate,
    );
    const averageInstall = toNumber(
      row.TotalJobAverage ??
        row.OpportunityJobAverage ??
        row.OpportunityAverageSale ??
        row.AverageInstall ??
        row.AvgTicket,
    );

    return {
      name: String(row.Name ?? row.TechnicianName ?? row.TechName ?? row.Tech ?? ""),
      installedRevenue,
      jobsCompleted,
      recallsCaused: toNumber(row.RecallsCaused),
      billableEfficiency,
      averageInstall,
      installedRevenueFormatted: installedRevenue.toFixed(2),
      billableEfficiencyFormatted: `${(billableEfficiency * 100).toFixed(1)}%`,
      averageInstallFormatted: averageInstall.toFixed(2)
    };
  });

  const rowsRanked = rows
    .slice()
    .sort(
      (left, right) =>
        right.installedRevenue - left.installedRevenue ||
        left.name.localeCompare(right.name),
    )
    .map((row, index) => ({ ...row, rankByRevenue: index + 1 }));

  const leader = rowsRanked[0] ?? null;

  return {
    rows,
    rowsRanked,
    totals: {
      jobsCompleted: sumBy(rows, (row) => row.jobsCompleted),
      recallsCaused: sumBy(rows, (row) => row.recallsCaused),
      billableEfficiencyAvg: Number(
        weightedAverage(rows, (row) => row.billableEfficiency, (row) => row.jobsCompleted).toFixed(3),
      ),
      averageInstall: Number(
        weightedAverage(rows, (row) => row.averageInstall, (row) => row.jobsCompleted).toFixed(2),
      ),
      installedRevenue: sumBy(rows, (row) => row.installedRevenue),
      leaderName: leader?.name ?? null,
      leaderRevenue: leader?.installedRevenue ?? 0
    },
    snapshotTime: report.snapshotTime
  };
}
