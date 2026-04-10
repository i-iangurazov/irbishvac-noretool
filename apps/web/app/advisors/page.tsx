import { compactMoney, LeaderboardPage, ratio } from "../../components/leaderboard-page";
import { fetchApi } from "../../lib/api";
import { resolveDashboardFilters } from "../../lib/dashboard-filters";

type AdvisorsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdvisorsPage({ searchParams }: AdvisorsPageProps) {
  const filters = await resolveDashboardFilters(
    searchParams,
    "America/Los_Angeles",
    "/advisors",
  );
  const data = await fetchApi<{
    rowsRanked: Array<{
      name: string;
      totalSales: number;
      closedAverageSale: number;
      closedOpportunitiesCount: number;
      closeRateRolling: number;
      salesOpportunitiesCount: number;
    }>;
    totals: {
      totalSales: number;
      totalOpportunities: number;
      totalClosedOpportunities: number;
      weightedCloseRate: number;
      weightedClosedAverageSale: number;
    };
    snapshotTime: string | null;
  }>(`/dashboard/advisors?${filters.apiQueryString}`);

  return (
    <LeaderboardPage
      path="/advisors"
      title="Comfort Advisors Board"
      subtitle="Advisor ranking and close-rate performance carried over from the exported board."
      freshness={data.snapshotTime}
      filters={filters}
      useHeadshots={true}
      kpis={[
        { label: "Total Sales", value: compactMoney(data.totals.totalSales) },
        { label: "Opportunities", value: String(data.totals.totalOpportunities) },
        { label: "Weighted Close Rate", value: ratio(data.totals.weightedCloseRate) },
        { label: "Closed Average Sale", value: compactMoney(data.totals.weightedClosedAverageSale) }
      ]}
      items={data.rowsRanked.map((row) => ({
        title: row.name,
        valueLabel: "Sales",
        value: compactMoney(row.totalSales),
        stats: [
          { label: "Closed Avg Sale", value: compactMoney(row.closedAverageSale) },
          { label: "Close Rate", value: ratio(row.closeRateRolling) },
          { label: "Opportunities", value: String(row.salesOpportunitiesCount) }
        ]
      }))}
    />
  );
}
