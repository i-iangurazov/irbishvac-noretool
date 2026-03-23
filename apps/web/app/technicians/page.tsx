import { compactMoney, LeaderboardPage, money, ratio } from "../../components/leaderboard-page";
import { formatNumber } from "@irbis/utils";
import { fetchApi } from "../../lib/api";
import { resolveDashboardFilters } from "../../lib/dashboard-filters";

type TechniciansPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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

export default async function TechniciansPage({ searchParams }: TechniciansPageProps) {
  const filters = await resolveDashboardFilters(searchParams, "America/Los_Angeles");
  const data = await fetchApi<{
    rowsRanked: Array<{
      name: string;
      businessUnit: string;
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
  }>(`/dashboard/technicians?${filters.apiQueryString}`);

  return (
    <LeaderboardPage
      path="/technicians"
      title="Service Technician Dashboard"
      subtitle="Technician leaderboard rebuilt from the Retool service dashboard."
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
        subtitle: row.businessUnit,
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
