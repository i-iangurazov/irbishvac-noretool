import type { PerformanceGoal } from "../performance-goals";
import { personnelSourceCoverage, type PersonnelSourceCoverage } from "../shared/personnel-coverage";
import {
  BUSINESS_UNIT_FIELD_KEYS,
  classifyFieldStaffDepartment,
  normalizeFieldStaffDepartment,
  type FieldStaffDepartment,
  POSITION_FIELD_KEYS,
  readTextField,
  TECHNICIAN_ID_FIELD_KEYS
} from "./field-staff-departments";
import { resolveTabularReport, sumBy, toNumber, toRatio, weightedAverage } from "../shared/report";

export type TechnicianExtra = {
  completedJobs?: number | null;
  callbackRate?: number | null;
  averageTicket?: number | null;
  commission?: number | null;
  photoUrl?: string | null;
};

export type TechnicianMetricRow = {
  goal?: PerformanceGoal | null;
  monthlyGoal?: PerformanceGoal | null;
  noActivity?: boolean;
  actualSourceAvailable?: boolean;
  name: string;
  businessUnit: string;
  department: FieldStaffDepartment | null;
  position: string | null;
  technicianId: string | null;
  completedRevenue: number;
  opportunityJobAverage: number;
  totalSales: number;
  salesOpportunity: number;
  closedOpportunities: number;
  closeRate: number;
  avgSaleFromOpps: number;
  replacementOpportunity: number;
  leadsSet: number;
  replacementLeadConvRate: number;
  totalTechLeadSales: number;
  membershipOpportunities: number;
  membershipsSold: number;
  techMembershipConvPct: number;
  totalInfluencedRevenue: number;
  completedJobs: number | null;
  callbackRate: number | null;
  averageTicket: number | null;
  commission: number;
  photoUrl: string | null;
  rankByRevenue?: number;
};

export type TechnicianDashboard = {
  sourceCoverage?: PersonnelSourceCoverage | undefined;
  personnelFetchedAt?: string;
  rows: TechnicianMetricRow[];
  rowsRanked: TechnicianMetricRow[];
  totals: {
    totalInfluencedRevenue: number;
    completedRevenue: number;
    avgCloseRate: string;
    avgAvgSaleFromOpps: number;
    avgMembershipConv: string;
  };
  snapshotTime: string | null;
};

export function buildTechnicianDashboard(
  input: unknown,
  options?: {
    commissionRate?: number;
    extrasByName?: Record<string, TechnicianExtra>;
    headshotsByName?: Record<string, string>;
  },
): TechnicianDashboard {
  const report = resolveTabularReport(input);
  const primaryCoverage = personnelSourceCoverage(input, ["Name", "CompletedRevenue", "CompletedJobs", "TotalSales", "SalesOpportunity", "ClosedOpportunities", "MembershipsSold"]);
  const supplement = input && typeof input === "object" ? (input as Record<string,unknown>).operationsSupplement : undefined;
  const operationsCoverage = personnelSourceCoverage(supplement, ["Name", "TechnicianId", "CompletedRevenue", "CompletedJobs", "TotalSales", "MembershipOpportunities", "MembershipsSold", "TotalLeadSales"]);
  const sourceRows = report.rows.slice();
  if (primaryCoverage && operationsCoverage) {
    const identity=(value:unknown)=>String(value??"").toLowerCase().replace(/[^a-z0-9]/g,"");
    for (const operational of resolveTabularReport(supplement).rows) {
      const id=readTextField(operational,TECHNICIAN_ID_FIELD_KEYS);
      const matches=sourceRows.map((row,index)=>({row,index})).filter(({row})=>{
        const rowId=readTextField(row,TECHNICIAN_ID_FIELD_KEYS);
        return rowId ? rowId===id : identity(row.Name)===identity(operational.Name);
      });
      if (matches.length>1) throw new Error("Ambiguous technician operational supplement");
      const match=matches[0];
      // Shared source fields agree; the compact scorecard keeps its own sales-opportunity definitions.
      if (match) sourceRows[match.index]={...operational,...match.row,TechnicianId:id};
      else sourceRows.push(operational);
    }
  }
  const extrasByName = options?.extrasByName ?? {};
  const commissionRate = options?.commissionRate ?? 0;
  const headshotsByName = options?.headshotsByName ?? {};

  const rows = sourceRows.map((row) => {
    const name = String(row.Name ?? "");
    const extra = extrasByName[name] ?? {};
    const businessUnit = readTextField(row, BUSINESS_UNIT_FIELD_KEYS) ?? "";
    const position = readTextField(row, POSITION_FIELD_KEYS);
    const technicianId = readTextField(row, TECHNICIAN_ID_FIELD_KEYS);
    const completedRevenue = toNumber(row.CompletedRevenue);
    const avgSaleFromOpps = toNumber(row.OpportunityAverageSale);
    const salesOpportunity = toNumber(row.SalesOpportunity);
    const closedOpportunities = toNumber(row.ClosedOpportunities);
    const closeRate =
      salesOpportunity > 0
        ? closedOpportunities / salesOpportunity
        : toNumber(row.CloseRate);
    const totalTechLeadSales = toNumber(row.TotalLeadSales);
    const totalInfluencedRevenue = completedRevenue + totalTechLeadSales;
    const department = classifyFieldStaffDepartment({
      businessUnit,
      position,
      sourceFamily: "technicians"
    });

    return {
      name,
      businessUnit,
      department,
      position,
      technicianId,
      completedRevenue,
      opportunityJobAverage: toNumber(row.OpportunityJobAverage),
      totalSales: toNumber(row.TotalSales),
      salesOpportunity,
      closedOpportunities,
      closeRate,
      avgSaleFromOpps,
      replacementOpportunity: toNumber(row.ReplacementOpportunity),
      leadsSet: toNumber(row.LeadsSet),
      replacementLeadConvRate: toRatio(row.ReplacementLeadConversionRate),
      totalTechLeadSales,
      membershipOpportunities: toNumber(row.MembershipOpportunities),
      membershipsSold: toNumber(row.MembershipsSold),
      techMembershipConvPct: toRatio(row.MembershipConversionRate),
      totalInfluencedRevenue,
      completedJobs: extra.completedJobs ?? (row.CompletedJobs != null ? toNumber(row.CompletedJobs) : null),
      callbackRate: extra.callbackRate ?? null,
      averageTicket:
        extra.averageTicket ?? (toNumber(row.OpportunityJobAverage) || avgSaleFromOpps || null),
      commission: extra.commission ?? totalInfluencedRevenue * commissionRate,
      photoUrl: extra.photoUrl ?? headshotsByName[name] ?? null
    };
  });

  const rowsRanked = rankTechnicianRows(rows);

  return {
    sourceCoverage: primaryCoverage && operationsCoverage ? primaryCoverage : undefined,
    rows,
    rowsRanked,
    totals: calculateTechnicianTotals(rows),
    snapshotTime: report.snapshotTime
  };
}

function rankTechnicianRows(rows: TechnicianMetricRow[]) {
  return rows
    .slice()
    .sort((left, right) => right.totalInfluencedRevenue - left.totalInfluencedRevenue)
    .map((row, index) => ({ ...row, rankByRevenue: index + 1 }));
}

function calculateTechnicianTotals(rows: TechnicianMetricRow[]): TechnicianDashboard["totals"] {
  const totalSalesOpp = sumBy(rows, (row) => row.salesOpportunity);
  const totalClosedOpp = sumBy(rows, (row) => row.closedOpportunities);
  const totalMemOpp = sumBy(rows, (row) => row.membershipOpportunities);
  const totalMemSold = sumBy(rows, (row) => row.membershipsSold);

  return {
    totalInfluencedRevenue: sumBy(rows, (row) => row.totalInfluencedRevenue),
    completedRevenue: sumBy(rows, (row) => row.completedRevenue),
    avgCloseRate: (totalSalesOpp > 0 ? totalClosedOpp / totalSalesOpp : 0).toFixed(3),
    avgAvgSaleFromOpps: Number(
      weightedAverage(
        rows,
        (row) => row.avgSaleFromOpps,
        (row) => row.closedOpportunities,
      ).toFixed(2),
    ),
    avgMembershipConv: (totalMemOpp > 0 ? totalMemSold / totalMemOpp : 0).toFixed(3)
  };
}

export function filterTechnicianDashboardByDepartment(
  dashboard: TechnicianDashboard,
  department: FieldStaffDepartment,
): TechnicianDashboard {
  const sourceRows = Array.isArray(dashboard.rows) ? dashboard.rows : dashboard.rowsRanked ?? [];
  const rows = sourceRows.filter((row) => {
    const resolvedDepartment =
      normalizeFieldStaffDepartment(row.department, "technicians") ??
      classifyFieldStaffDepartment({
        businessUnit: row.businessUnit,
        position: row.position,
        sourceFamily: "technicians"
      });

    return resolvedDepartment === department;
  });

  return {
    ...dashboard,
    rows,
    rowsRanked: rankTechnicianRows(rows),
    totals: calculateTechnicianTotals(rows)
  };
}

export function withTechnicianRows(dashboard: TechnicianDashboard, rows: TechnicianMetricRow[]): TechnicianDashboard {
  const rowsRanked = rankTechnicianRows(rows);
  return { ...dashboard, rows, rowsRanked, totals: calculateTechnicianTotals(rows) };
}
