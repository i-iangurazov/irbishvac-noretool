import type { PerformanceGoal } from "@irbis/domain";
import { formatNumber } from "@irbis/utils";
import { compactMoney, LeaderboardPage, money, ratio } from "./leaderboard-page";
import { fetchApi } from "../lib/api";
import { resolveDashboardFilters, type DashboardSearchParams } from "../lib/dashboard-filters";
import { getTvPerformanceGoal } from "../lib/performance-goals";
import { staffMetricValue, staffTotalsAvailable } from "../lib/staff-metric-display";

type FieldTechnicianBoardPageProps = {
  searchParams?: DashboardSearchParams | undefined;
  path: string;
  apiPath: string;
  title: string;
  subtitle: string;
};

function count(value: number) {
  return formatNumber(value);
}

export async function FieldTechnicianBoardPage({
  searchParams,
  path,
  apiPath,
  title,
  subtitle
}: FieldTechnicianBoardPageProps) {
  const filters = await resolveDashboardFilters(
    searchParams,
    "America/Los_Angeles",
    path,
  );
  const data = await fetchApi<{
    rowsRanked: Array<{
      name: string;
      actualSourceAvailable?: boolean;
      goal?: PerformanceGoal | null;
      businessUnit: string;
      department: string | null;
      position: string | null;
      photoUrl: string | null;
      totalInfluencedRevenue: number;
      completedRevenue: number;
      avgSaleFromOpps: number;
      replacementLeadConvRate: number;
      totalTechLeadSales: number;
      totalSales: number;
      membershipsSold: number;
      closeRate: number;
      salesOpportunity: number;
    }>;
    totals: {
      totalInfluencedRevenue: number;
      completedRevenue: number;
      avgCloseRate: string;
      avgMembershipConv: string;
    };
    snapshotTime: string | null;
  }>(`/dashboard/${apiPath}?${filters.apiQueryString}`);
  const total = (value: number, format: (value: number) => string) =>
    staffMetricValue(value, format, staffTotalsAvailable(data.rowsRanked, data.snapshotTime));

  return (
    <LeaderboardPage
      path={path}
      title={title}
      subtitle={subtitle}
      freshness={data.snapshotTime}
      filters={filters}
      layout="people-showcase"
      maxVisibleItems={4}
      showcaseColumns={4}
      useHeadshots={true}
      kpis={[
        { label: "Influenced Revenue", value: total(data.totals.totalInfluencedRevenue, money) },
        { label: "Completed Revenue", value: total(data.totals.completedRevenue, money) },
        { label: "Average Close Rate", value: total(Number(data.totals.avgCloseRate), ratio) },
        { label: "Membership Conversion", value: total(Number(data.totals.avgMembershipConv), ratio) }
      ]}
      items={data.rowsRanked.map((row) => {
        const goal = getTvPerformanceGoal(row.goal);
        const actual = (value: number, format: (value: number) => string) =>
          staffMetricValue(value, format, row.actualSourceAvailable);
        const goalValue = (value: string, target: string | null) =>
          target ? `${value} / ${target}` : goal ? `${value} / Pending` : value;

        return {
          title: row.name,
          subtitle: row.position ?? row.businessUnit,
          imageUrl: row.photoUrl,
          valueLabel: row.actualSourceAvailable === false ? "Data unavailable" : "Total Revenue",
          value: row.actualSourceAvailable === false ? "—" : compactMoney(row.totalInfluencedRevenue),
          stats: [
            { label: "Completed Revenue", value: actual(row.completedRevenue, money) },
            { label: "Close / Goal", value: goalValue(actual(row.closeRate, ratio), goal?.targetRate != null ? ratio(goal.targetRate) : null) },
            { label: "Rev / Opp / Goal", value: goalValue(actual(row.avgSaleFromOpps, money), goal?.targetAverage != null ? money(goal.targetAverage) : null) },
            { label: "Opps / Goal", value: goalValue(actual(row.salesOpportunity, count), goal?.targetOpportunitiesMonthly != null ? count(goal.targetOpportunitiesMonthly) : null) },
            { label: "Memberships Sold", value: actual(row.membershipsSold, count) },
            { label: "Lead Conv.", value: actual(row.replacementLeadConvRate, ratio) },
            { label: "Tech Lead Sales", value: actual(row.totalTechLeadSales, money) },
            { label: "Sales / Goal", value: goalValue(actual(row.totalSales, compactMoney), goal?.monthlySalesGoal != null ? compactMoney(goal.monthlySalesGoal) : null) }
          ]
        };
      })}
    />
  );
}
