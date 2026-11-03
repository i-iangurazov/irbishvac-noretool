import type { PerformanceGoal } from "@irbis/domain";
import {
  compactMoney,
  LeaderboardPage,
  ratio,
} from "../../components/leaderboard-page";
import { fetchApi } from "../../lib/api";
import { resolveDashboardFilters } from "../../lib/dashboard-filters";
import { getTvPerformanceGoal } from "../../lib/performance-goals";
import { preparedStaffPortraitUrls } from "../../lib/staff-portraits";
import { staffMetricValue, staffTotalsAvailable } from "../../lib/staff-metric-display";

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
      actualSourceAvailable?: boolean;
      goal?: PerformanceGoal | null;
      monthlyGoal?: PerformanceGoal | null;
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
  const total = (value: number, format: (value: number) => string) =>
    staffMetricValue(value, format, staffTotalsAvailable(data.rowsRanked, data.snapshotTime));

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
        { label: "Total Sales", value: total(data.totals.totalSales, compactMoney) },
        {
          label: "Opportunities",
          value: total(data.totals.totalOpportunities, String),
        },
        {
          label: "Weighted Close Rate",
          value: total(data.totals.weightedCloseRate, ratio),
        },
        {
          label: "Closed Average Sale",
          value: total(data.totals.weightedClosedAverageSale, compactMoney),
        },
      ]}
      items={data.rowsRanked.map((row) => {
        const goal = getTvPerformanceGoal(row.goal);
        const monthlyGoal = getTvPerformanceGoal(row.monthlyGoal ?? row.goal);
        const actual = (value: number, format: (value: number) => string) =>
          staffMetricValue(value, format, row.actualSourceAvailable);
        const pair = (actual: string, target: string | null) =>
          target ? `${actual} / ${target}` : actual;

        return {
          title: row.name,
          imageUrl: portraits.get(row.name) ?? row.photoUrl,
          valueLabel: row.actualSourceAvailable === false ? "Data unavailable" : "Sales",
          value: row.actualSourceAvailable === false ? "—" : compactMoney(row.totalSales),
          stats: [
            {
              label: "Monthly Sales Goal",
              value:
                monthlyGoal?.monthlySalesGoal != null
                  ? compactMoney(monthlyGoal.monthlySalesGoal)
                  : "Not set",
            },
            {
              label: "Avg Sale / Goal",
              value: pair(
                actual(row.closedAverageSale, compactMoney),
                goal?.targetAverage != null
                  ? compactMoney(goal.targetAverage)
                  : null,
              ),
            },
            {
              label: "Close / Goal",
              value: pair(
                actual(row.closeRateRolling, ratio),
                goal?.targetRate != null ? ratio(goal.targetRate) : null,
              ),
            },
            {
              label:
                filters.preset === "mtd" && !filters.customRange
                  ? "Opps / Goal"
                  : "Opportunities",
              value: pair(
                actual(row.salesOpportunitiesCount, String),
                filters.preset === "mtd" &&
                  !filters.customRange &&
                  goal?.targetOpportunitiesMonthly != null
                  ? String(goal.targetOpportunitiesMonthly)
                  : null,
              ),
            },
            {
              label: "Membership Goal/mo",
              value:
                monthlyGoal?.membershipMonthlyGoal != null
                  ? String(monthlyGoal.membershipMonthlyGoal)
                  : "Not set",
            },
            {
              label: "Monthly Review Goal",
              value:
                monthlyGoal?.reviewMonthlyGoal != null
                  ? String(monthlyGoal.reviewMonthlyGoal)
                  : "Not set",
            },
          ],
        };
      })}
    />
  );
}
