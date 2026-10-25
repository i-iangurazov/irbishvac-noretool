import {
  compactMoney,
  LeaderboardPage,
  ratio,
} from "../../components/leaderboard-page";
import { fetchApi } from "../../lib/api";
import { resolveDashboardFilters } from "../../lib/dashboard-filters";
import { getTvPerformanceGoal } from "../../lib/performance-goals";
import { preparedStaffPortraitUrls } from "../../lib/staff-portraits";

type AdvisorsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdvisorsPage({
  searchParams,
}: AdvisorsPageProps) {
  const filters = await resolveDashboardFilters(
    searchParams,
    "America/Los_Angeles",
    "/advisors",
  );
  const data = await fetchApi<{
    rowsRanked: Array<{
      name: string;
      photoUrl?: string | null;
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
  const portraits = await preparedStaffPortraitUrls(
    data.rowsRanked.map((row) => row.name),
  );

  return (
    <LeaderboardPage
      path="/advisors"
      title="HVAC Sales"
      subtitle="Sales performance for the ServiceTitan HVAC sales team."
      freshness={data.snapshotTime}
      filters={filters}
      layout="people-showcase"
      maxVisibleItems={4}
      useHeadshots={true}
      kpis={[
        { label: "Total Sales", value: compactMoney(data.totals.totalSales) },
        {
          label: "Opportunities",
          value: String(data.totals.totalOpportunities),
        },
        {
          label: "Weighted Close Rate",
          value: ratio(data.totals.weightedCloseRate),
        },
        {
          label: "Closed Average Sale",
          value: compactMoney(data.totals.weightedClosedAverageSale),
        },
      ]}
      items={data.rowsRanked.map((row) => {
        const goal = getTvPerformanceGoal(row.name);
        const pair = (actual: string, target: string | null) =>
          target ? `${actual} / ${target}` : actual;

        return {
          title: row.name,
          imageUrl: portraits.get(row.name) ?? row.photoUrl,
          valueLabel: "Sales",
          value: compactMoney(row.totalSales),
          stats: [
            {
              label: "Monthly Sales Goal",
              value:
                goal?.monthlySalesGoal != null
                  ? compactMoney(goal.monthlySalesGoal)
                  : "Pending",
            },
            {
              label: "Avg Sale / Goal",
              value: pair(
                compactMoney(row.closedAverageSale),
                goal?.targetAverage != null
                  ? compactMoney(goal.targetAverage)
                  : null,
              ),
            },
            {
              label: "Close / Goal",
              value: pair(
                ratio(row.closeRateRolling),
                goal?.targetRate != null ? ratio(goal.targetRate) : null,
              ),
            },
            {
              label:
                filters.preset === "mtd" && !filters.customRange
                  ? "Opps / Goal"
                  : "Opportunities",
              value: pair(
                String(row.salesOpportunitiesCount),
                filters.preset === "mtd" &&
                  !filters.customRange &&
                  goal?.targetOpportunitiesMonthly != null
                  ? String(goal.targetOpportunitiesMonthly)
                  : null,
              ),
            },
            {
              label: "Monthly Membership Goal",
              value:
                goal?.membershipMonthlyGoal != null
                  ? String(goal.membershipMonthlyGoal)
                  : "Pending",
            },
            {
              label: "Monthly Review Goal",
              value:
                goal?.reviewMonthlyGoal != null
                  ? String(goal.reviewMonthlyGoal)
                  : "Pending",
            },
          ],
        };
      })}
    />
  );
}
