import { compactMoney, LeaderboardPage, money, ratio } from "../../components/leaderboard-page";
import { fetchApi } from "../../lib/api";
import { resolveDashboardFilters } from "../../lib/dashboard-filters";

type InstallersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InstallersPage({ searchParams }: InstallersPageProps) {
  const filters = await resolveDashboardFilters(
    searchParams,
    "America/Los_Angeles",
    "/installers",
  );
  const data = await fetchApi<{
    rowsRanked: Array<{
      name: string;
      installedRevenue: number;
      jobsCompleted: number;
      recallsCaused: number;
      billableEfficiency: number;
      averageInstall: number;
    }>;
    totals: {
      installedRevenue: number;
      jobsCompleted: number;
      recallsCaused: number;
      billableEfficiencyAvg: number;
    };
    snapshotTime: string | null;
  }>(`/dashboard/installers?${filters.apiQueryString}`);

  return (
    <LeaderboardPage
      path="/installers"
      title="Installer Dashboard"
      subtitle="Installer rankings and weighted efficiency metrics migrated out of Retool."
      freshness={data.snapshotTime}
      filters={filters}
      useHeadshots={true}
      kpis={[
        { label: "Installed Revenue", value: money(data.totals.installedRevenue) },
        { label: "Jobs Completed", value: String(data.totals.jobsCompleted) },
        { label: "Recalls Caused", value: String(data.totals.recallsCaused) },
        { label: "Billable Efficiency", value: ratio(data.totals.billableEfficiencyAvg) }
      ]}
      items={data.rowsRanked.map((row) => ({
        title: row.name,
        valueLabel: "Revenue",
        value: compactMoney(row.installedRevenue),
        stats: [
          { label: "Jobs Completed", value: String(row.jobsCompleted) },
          { label: "Recalls", value: String(row.recallsCaused) },
          { label: "Efficiency", value: ratio(row.billableEfficiency) },
          { label: "Average Install", value: money(row.averageInstall) }
        ]
      }))}
    />
  );
}
