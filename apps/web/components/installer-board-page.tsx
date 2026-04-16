import { compactMoney, LeaderboardPage, money, ratio } from "./leaderboard-page";
import { fetchApi } from "../lib/api";
import { resolveDashboardFilters, type DashboardSearchParams } from "../lib/dashboard-filters";

type InstallerBoardPageProps = {
  searchParams?: DashboardSearchParams | undefined;
  path: string;
  apiPath: string;
  title: string;
  subtitle: string;
};

export async function InstallerBoardPage({
  searchParams,
  path,
  apiPath,
  title,
  subtitle
}: InstallerBoardPageProps) {
  const filters = await resolveDashboardFilters(
    searchParams,
    "America/Los_Angeles",
    path,
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
