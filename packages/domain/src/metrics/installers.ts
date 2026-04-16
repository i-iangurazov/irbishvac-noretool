import {
  BUSINESS_UNIT_FIELD_KEYS,
  classifyFieldStaffDepartment,
  type FieldStaffDepartment,
  POSITION_FIELD_KEYS,
  readTextField,
  TECHNICIAN_ID_FIELD_KEYS
} from "./field-staff-departments";
import { resolveTabularReport, sumBy, toNumber, toRatio, weightedAverage } from "../shared/report";

export type InstallerMetricRow = {
  name: string;
  businessUnit: string | null;
  department: FieldStaffDepartment | null;
  position: string | null;
  technicianId: string | null;
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
    const businessUnit = readTextField(row, BUSINESS_UNIT_FIELD_KEYS);
    const position = readTextField(row, POSITION_FIELD_KEYS);
    const technicianId = readTextField(row, TECHNICIAN_ID_FIELD_KEYS);
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
      businessUnit,
      department: classifyFieldStaffDepartment({
        businessUnit,
        position,
        sourceFamily: "installers"
      }),
      position,
      technicianId,
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

  const rowsRanked = rankInstallerRows(rows);

  const leader = rowsRanked[0] ?? null;

  return {
    rows,
    rowsRanked,
    totals: calculateInstallerTotals(rows, leader),
    snapshotTime: report.snapshotTime
  };
}

function rankInstallerRows(rows: InstallerMetricRow[]) {
  return rows
    .slice()
    .sort(
      (left, right) =>
        right.installedRevenue - left.installedRevenue ||
        left.name.localeCompare(right.name),
    )
    .map((row, index) => ({ ...row, rankByRevenue: index + 1 }));
}

function calculateInstallerTotals(
  rows: InstallerMetricRow[],
  leader: InstallerMetricRow | null,
): InstallerDashboard["totals"] {
  return {
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
  };
}

export function filterInstallerDashboardByDepartment(
  dashboard: InstallerDashboard,
  department: FieldStaffDepartment,
): InstallerDashboard {
  const sourceRows = Array.isArray(dashboard.rows) ? dashboard.rows : dashboard.rowsRanked ?? [];
  const rows = sourceRows.filter((row) => {
    const resolvedDepartment =
      row.department ??
      classifyFieldStaffDepartment({
        businessUnit: row.businessUnit,
        position: row.position,
        sourceFamily: "installers"
      });

    return resolvedDepartment === department;
  });
  const rowsRanked = rankInstallerRows(rows);

  return {
    ...dashboard,
    rows,
    rowsRanked,
    totals: calculateInstallerTotals(rows, rowsRanked[0] ?? null)
  };
}
