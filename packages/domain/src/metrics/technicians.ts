import { weightedAverage } from "../shared/report";
import { resolveTabularReport, sumBy, toNumber, toRatio } from "../shared/report";

export type TechnicianExtra = {
  completedJobs?: number | null;
  callbackRate?: number | null;
  averageTicket?: number | null;
  commission?: number | null;
  photoUrl?: string | null;
};

export type TechnicianMetricRow = {
  name: string;
  businessUnit: string;
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
  const extrasByName = options?.extrasByName ?? {};
  const commissionRate = options?.commissionRate ?? 0;
  const headshotsByName = options?.headshotsByName ?? {};

  const rows = report.rows.map((row) => {
    const name = String(row.Name ?? "");
    const extra = extrasByName[name] ?? {};
    const completedRevenue = toNumber(row.CompletedRevenue);
    const avgSaleFromOpps = toNumber(row.OpportunityAverageSale);
    const totalTechLeadSales = toNumber(row.TotalLeadSales);
    const totalInfluencedRevenue = completedRevenue + totalTechLeadSales;

    return {
      name,
      businessUnit: String(row.TechnicianBusinessUnit ?? ""),
      completedRevenue,
      opportunityJobAverage: toNumber(row.OpportunityJobAverage),
      totalSales: toNumber(row.TotalSales),
      salesOpportunity: toNumber(row.SalesOpportunity),
      closedOpportunities: toNumber(row.ClosedOpportunities),
      closeRate: toNumber(row.CloseRate),
      avgSaleFromOpps,
      replacementOpportunity: toNumber(row.ReplacementOpportunity),
      leadsSet: toNumber(row.LeadsSet),
      replacementLeadConvRate: toRatio(row.ReplacementLeadConversionRate),
      totalTechLeadSales,
      membershipOpportunities: toNumber(row.MembershipOpportunities),
      membershipsSold: toNumber(row.MembershipsSold),
      techMembershipConvPct: toRatio(row.MembershipConversionRate),
      totalInfluencedRevenue,
      completedJobs: extra.completedJobs ?? null,
      callbackRate: extra.callbackRate ?? null,
      averageTicket:
        extra.averageTicket ?? (toNumber(row.OpportunityJobAverage) || avgSaleFromOpps || null),
      commission: extra.commission ?? totalInfluencedRevenue * commissionRate,
      photoUrl: extra.photoUrl ?? headshotsByName[name] ?? null
    };
  });

  const rowsRanked = rows
    .slice()
    .sort((left, right) => right.totalInfluencedRevenue - left.totalInfluencedRevenue)
    .map((row, index) => ({ ...row, rankByRevenue: index + 1 }));

  const totalSalesOpp = sumBy(rows, (row) => row.salesOpportunity);
  const totalClosedOpp = sumBy(rows, (row) => row.closedOpportunities);
  const totalMemOpp = sumBy(rows, (row) => row.membershipOpportunities);
  const totalMemSold = sumBy(rows, (row) => row.membershipsSold);

  return {
    rows,
    rowsRanked,
    totals: {
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
    },
    snapshotTime: report.snapshotTime
  };
}
