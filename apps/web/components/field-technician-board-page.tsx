import { formatNumber } from "@irbis/utils";
import { compactMoney, LeaderboardPage, money, ratio } from "./leaderboard-page";
import { fetchApi } from "../lib/api";
import { resolveDashboardFilters, type DashboardSearchParams } from "../lib/dashboard-filters";

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

function plainMetric(value: number) {
  const integer = Number.isInteger(value);

  return formatNumber(value, {
    minimumFractionDigits: integer ? 0 : 2,
    maximumFractionDigits: integer ? 0 : 2
  });
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
      useHeadshots={true}
      kpis={[
        { label: "Influenced Revenue", value: money(data.totals.totalInfluencedRevenue) },
        { label: "Completed Revenue", value: money(data.totals.completedRevenue) },
        { label: "Average Close Rate", value: ratio(Number(data.totals.avgCloseRate)) },
        { label: "Membership Conversion", value: ratio(Number(data.totals.avgMembershipConv)) }
      ]}
      items={data.rowsRanked.map((row) => ({
        title: row.name,
        subtitle: row.position ?? row.businessUnit,
        imageUrl: row.photoUrl,
        valueLabel: "Total Revenue",
        value: compactMoney(row.totalInfluencedRevenue),
        stats: [
          { label: "Completed Revenue", value: money(row.completedRevenue) },
          { label: "Close Rate", value: ratio(row.closeRate) },
          { label: "Average Sale from Opportunities", value: money(row.avgSaleFromOpps) },
          { label: "Memberships Sold", value: count(row.membershipsSold) },
          { label: "Replacement Lead Conversion Rate", value: ratio(row.replacementLeadConvRate) },
          { label: "Total Tech Lead Sales", value: money(row.totalTechLeadSales) },
          { label: "Total Sales", value: plainMetric(row.totalSales) }
        ]
      }))}
    />
  );
}
