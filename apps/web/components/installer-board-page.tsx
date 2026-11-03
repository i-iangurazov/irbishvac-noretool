import {
  compactMoney,
  LeaderboardPage,
  money,
  ratio,
} from "./leaderboard-page";
import { fetchApi } from "../lib/api";
import {
  resolveDashboardFilters,
  type DashboardSearchParams,
} from "../lib/dashboard-filters";
import "./installer-board.css";
import { staffMetricValue, staffTotalsAvailable } from "../lib/staff-metric-display";

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
  subtitle,
}: InstallerBoardPageProps) {
  const filters = await resolveDashboardFilters(
    searchParams,
    "America/Los_Angeles",
    path,
  );
  const data = await fetchApi<{
    rowsRanked: Array<{
      name: string;
      actualSourceAvailable?: boolean;
      photoUrl?: string | null;
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
      maxVisibleItems={path === "/installers" ? 8 : 4}
      showcaseVariant={path === "/installers" ? "install-eight" : "standard"}
      showcaseColumns={4}
      useHeadshots={true}
      kpis={[
        {
          label: "Installed Revenue",
          value: total(data.totals.installedRevenue, money),
        },
        { label: "Jobs Completed", value: total(data.totals.jobsCompleted, String) },
        { label: "Recalls Caused", value: total(data.totals.recallsCaused, String) },
        {
          label: "Billable Efficiency",
          value: total(data.totals.billableEfficiencyAvg, ratio),
        },
      ]}
      items={data.rowsRanked.map((row) => {
        const actual = (value: number, format: (value: number) => string) =>
          staffMetricValue(value, format, row.actualSourceAvailable);
        return {
          title: row.name,
          imageUrl: row.photoUrl,
          valueLabel: row.actualSourceAvailable === false ? "Data unavailable" : "Revenue",
          value: row.actualSourceAvailable === false ? "—" : compactMoney(row.installedRevenue),
          stats: [
            { label: "Jobs Completed", value: actual(row.jobsCompleted, String) },
            { label: "Recalls Caused", value: actual(row.recallsCaused, String) },
            { label: "Efficiency", value: actual(row.billableEfficiency, ratio) },
            { label: "Average Install", value: actual(row.averageInstall, money) },
          ],
        };
      })}
    />
  );
}
