import { DashboardShell, DataFreshnessBadge, EmptyDashboardState, FilterBar } from "@irbis/ui";
import { formatPercent } from "@irbis/utils";
import { navItems, fetchApi } from "../../../lib/api";
import { getBrandLogoUrl } from "../../../lib/assets";
import { resolveDashboardFilters } from "../../../lib/dashboard-filters";

type CallCenterSummaryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function SummaryMetric(props: { label: string; value: string; accent?: boolean }) {
  return (
    <article className="rounded-[1rem] border border-[#e9e2d9] bg-[#fbfbfd] px-4 py-4 text-center shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="text-[0.88rem] font-bold leading-tight text-[#555] md:text-[0.92rem]">
        {props.label}
      </div>
      <div
        className={`mt-3 text-[1.8rem] font-black leading-none tracking-tight md:text-[2rem] ${
          props.accent ? "text-[#1b66c9]" : "text-[#202028]"
        }`}
      >
        {props.value}
      </div>
    </article>
  );
}

export default async function CallCenterSummaryPage({ searchParams }: CallCenterSummaryPageProps) {
  const filters = await resolveDashboardFilters(searchParams, "America/Los_Angeles");
  const data = await fetchApi<{
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
  }>(`/dashboard/call-center/summary?${filters.apiQueryString}`);

  const metrics = [
    { label: "Lead Calls", value: String(data.summary.leadCalls) },
    { label: "Inbound Calls Booked", value: String(data.summary.inboundBooked) },
    { label: "Call Booking Rate", value: formatPercent(data.summary.bookingRate), accent: true },
    { label: "Manual Calls Booked", value: String(data.summary.manualBooked) },
    { label: "Total Jobs Booked", value: String(data.summary.totalJobs) },
    { label: "Cancelled Before Dispatch", value: String(data.summary.cancelledBeforeDispatch) },
    { label: "Cancellation %", value: formatPercent(data.summary.cancellationRate), accent: true }
  ];

  return (
    <DashboardShell
      title="Call Center Performance Summary"
      subtitle="Call center summary board"
      navItems={navItems}
      activePath="/call-center/summary"
      brandLogoUrl={getBrandLogoUrl()}
      headerContent={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <FilterBar
            from={filters.fromLabel}
            to={filters.toLabel}
            presets={[
              { label: "YTD", href: "/call-center/summary?preset=ytd", active: filters.preset === "ytd" },
              { label: "MTD", href: "/call-center/summary?preset=mtd", active: filters.preset === "mtd" }
            ]}
          />
          <DataFreshnessBadge value={data.snapshotTime} />
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {data.snapshotTime ? (
          <section className="rounded-[1rem] border border-[#ebe2d8] bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfaf8_100%)] px-5 py-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)] md:px-6 md:py-6">
            <h2 className="text-center text-[1.55rem] font-black tracking-tight text-[#2f3036] md:text-[1.8rem]">
              Call Center Performance Summary
            </h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <SummaryMetric
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  {...(metric.accent ? { accent: true } : {})}
                />
              ))}
            </div>
          </section>
        ) : (
          <EmptyDashboardState
            title="No cached call-center snapshot for this range yet"
            description="A background refresh was queued for this filter scope. The summary will appear once the worker stores the real snapshot."
          />
        )}
      </div>
    </DashboardShell>
  );
}
