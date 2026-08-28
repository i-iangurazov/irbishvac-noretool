import { formatNumber } from "@irbis/utils";
import { compactMoney, LeaderboardPage, money, ratio } from "./leaderboard-page";
import { fetchApi } from "../lib/api";
import { resolveDashboardFilters, type DashboardSearchParams } from "../lib/dashboard-filters";
import { getTvPerformanceGoal } from "../lib/performance-goals";

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

  return (
    <LeaderboardPage
      path={path}
      title={title}
      subtitle={subtitle}
      freshness={data.snapshotTime}
      filters={filters}
      layout="people-showcase"
      maxVisibleItems={8}
      showcaseColumns={4}
      useHeadshots={true}
      kpis={[
        { label: "Influenced Revenue", value: money(data.totals.totalInfluencedRevenue) },
        { label: "Completed Revenue", value: money(data.totals.completedRevenue) },
        { label: "Average Close Rate", value: ratio(Number(data.totals.avgCloseRate)) },
        { label: "Membership Conversion", value: ratio(Number(data.totals.avgMembershipConv)) }
      ]}
      items={data.rowsRanked.map((row) => {
        const goal = getTvPerformanceGoal(row.name);
        const goalValue = (value: string, target: string | null) =>
          target ? `${value} / ${target}` : goal?.status === "UPDATED_GOAL_PENDING" ? `${value} / Pending` : value;

        return {
          title: row.name,
          subtitle: row.position ?? row.businessUnit,
          imageUrl: row.photoUrl,
          valueLabel: "Total Revenue",
          value: compactMoney(row.totalInfluencedRevenue),
          stats: [
            { label: "Completed Revenue", value: money(row.completedRevenue) },
            { label: "Close / Goal", value: goalValue(ratio(row.closeRate), goal?.targetRate != null ? ratio(goal.targetRate) : null) },
            { label: "Rev / Opp / Goal", value: goalValue(money(row.avgSaleFromOpps), goal?.targetAverage != null ? money(goal.targetAverage) : null) },
            { label: "Opps / Goal", value: goalValue(count(row.salesOpportunity), goal?.targetOpportunitiesMonthly != null ? count(goal.targetOpportunitiesMonthly) : null) },
            { label: "Memberships Sold", value: count(row.membershipsSold) },
            { label: "Lead Conv.", value: ratio(row.replacementLeadConvRate) },
            { label: "Tech Lead Sales", value: money(row.totalTechLeadSales) },
            { label: "Sales / Goal", value: goalValue(compactMoney(row.totalSales), goal?.monthlySalesGoal != null ? compactMoney(goal.monthlySalesGoal) : null) }
          ]
        };
      })}
    />
  );
}
