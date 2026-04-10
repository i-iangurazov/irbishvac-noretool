import { LeaderboardPage, ratio } from "../../components/leaderboard-page";
import { fetchApi } from "../../lib/api";
import { resolveDashboardFilters } from "../../lib/dashboard-filters";

type LeadsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const filters = await resolveDashboardFilters(
    searchParams,
    "America/Los_Angeles",
    "/leads",
  );
  const data = await fetchApi<{
    rowsRanked: Array<{
      name: string;
      leadsGenerated: number;
      goodLeads: number;
      bookedLeads: number;
      bookingRate: number;
    }>;
    snapshotTime: string | null;
  }>(`/dashboard/leads?${filters.apiQueryString}`);

  return (
    <LeaderboardPage
      path="/leads"
      title="Lead Generation"
      subtitle="Lead generation leaderboard built from the Retool transformer rules."
      freshness={data.snapshotTime}
      filters={filters}
      kpis={[
        { label: "Top Team", value: data.rowsRanked[0]?.name ?? "N/A" },
        { label: "Leads Generated", value: String(data.rowsRanked[0]?.leadsGenerated ?? 0) },
        { label: "Good Leads", value: String(data.rowsRanked[0]?.goodLeads ?? 0) },
        { label: "Booking Rate", value: ratio(data.rowsRanked[0]?.bookingRate ?? 0) }
      ]}
      items={data.rowsRanked.map((row) => ({
        title: row.name,
        valueLabel: "Leads",
        value: String(row.leadsGenerated),
        stats: [
          { label: "Good Leads", value: String(row.goodLeads) },
          { label: "Booked Leads", value: String(row.bookedLeads) },
          { label: "Booking Rate", value: ratio(row.bookingRate) }
        ]
      }))}
    />
  );
}
