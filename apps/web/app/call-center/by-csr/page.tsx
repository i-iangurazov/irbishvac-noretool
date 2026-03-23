import { LeaderboardPage, ratio } from "../../../components/leaderboard-page";
import { fetchApi } from "../../../lib/api";
import { resolveDashboardFilters } from "../../../lib/dashboard-filters";

type CallCenterByCsrPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CallCenterByCsrPage({ searchParams }: CallCenterByCsrPageProps) {
  const filters = await resolveDashboardFilters(searchParams, "America/Los_Angeles");
  const data = await fetchApi<{
    rowsRanked: Array<{
      name: string;
      role: string | null;
      leadsReceived: number;
      inboundCallsBooked: number;
      manualCallsBooked: number;
      totalJobsBooked: number;
      callBookingRate: number;
      cancelledBeforeDispatch: number;
      cancellationRate: number;
    }>;
    summary: {
      leadCalls: number;
      inboundBooked: number;
      manualBooked: number;
      totalJobs: number;
      bookingRate: number;
      cancelledBeforeDispatch: number;
      cancellationRate: number;
    };
    snapshotTime: string | null;
  }>(`/dashboard/call-center/by-csr?${filters.apiQueryString}`);

  return (
    <LeaderboardPage
      path="/call-center/by-csr"
      title="Call Center Performance By CSR"
      subtitle="CSR-by-CSR leaderboard preserving the current ranking and booking-rate semantics."
      freshness={data.snapshotTime}
      filters={filters}
      useHeadshots={true}
      kpis={[
        { label: "Lead Calls", value: String(data.summary.leadCalls) },
        { label: "Inbound Booked", value: String(data.summary.inboundBooked) },
        { label: "Manual Booked", value: String(data.summary.manualBooked) },
        { label: "Booking Rate", value: ratio(data.summary.bookingRate) },
        { label: "Cancelled", value: String(data.summary.cancelledBeforeDispatch) }
      ]}
      items={data.rowsRanked.map((row) => ({
        title: row.name,
        subtitle: row.role ?? undefined,
        valueLabel: "Call Booking Rate",
        value: ratio(row.callBookingRate),
        stats: [
          { label: "Lead Calls", value: String(row.leadsReceived) },
          { label: "Inbound", value: String(row.inboundCallsBooked) },
          { label: "Manual", value: String(row.manualCallsBooked) },
          { label: "Total Jobs", value: String(row.totalJobsBooked) },
          { label: "Cancelled", value: String(row.cancelledBeforeDispatch) },
          { label: "Cancellation %", value: ratio(row.cancellationRate) }
        ]
      }))}
    />
  );
}
