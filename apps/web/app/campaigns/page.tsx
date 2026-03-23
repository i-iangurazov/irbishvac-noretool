import { compactMoney, LeaderboardPage, ratio } from "../../components/leaderboard-page";
import { fetchApi } from "../../lib/api";
import { resolveDashboardFilters } from "../../lib/dashboard-filters";

type CampaignsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const filters = await resolveDashboardFilters(searchParams, "America/Los_Angeles");
  const data = await fetchApi<{
    rowsRanked: Array<{
      name: string;
      leadCalls: number;
      bookedJobsByCall: number;
      bookingRate: number | null;
      campaignCost: number;
      completedRevenue: number;
      roi: number | null;
    }>;
    snapshotTime: string | null;
  }>(`/dashboard/campaigns?${filters.apiQueryString}`);

  return (
    <LeaderboardPage
      path="/campaigns"
      title="Campaign Summary Report"
      subtitle="Campaign leaderboards preserving lead-call sorting and ROI handling."
      freshness={data.snapshotTime}
      filters={filters}
      kpis={[
        { label: "Top Campaign", value: data.rowsRanked[0]?.name ?? "N/A" },
        { label: "Lead Calls", value: String(data.rowsRanked[0]?.leadCalls ?? 0) },
        { label: "Completed Revenue", value: compactMoney(data.rowsRanked[0]?.completedRevenue ?? 0) },
        { label: "ROI", value: `${(data.rowsRanked[0]?.roi ?? 0).toFixed(1)}%` }
      ]}
      items={data.rowsRanked.map((row) => ({
        title: row.name,
        valueLabel: "Calls",
        value: String(row.leadCalls),
        stats: [
          { label: "Booked By Call", value: String(row.bookedJobsByCall) },
          { label: "Booking Rate", value: row.bookingRate == null ? "N/A" : ratio(row.bookingRate) },
          { label: "Cost", value: compactMoney(row.campaignCost) },
          { label: "Revenue", value: compactMoney(row.completedRevenue) }
        ]
      }))}
    />
  );
}
