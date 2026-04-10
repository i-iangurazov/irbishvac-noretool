import {
  DashboardShell,
  DataFreshnessBadge,
  EmptyDashboardState,
  FilterBar,
} from "@irbis/ui";
import { formatPercent } from "@irbis/utils";
import { navItems, fetchApi } from "../../../lib/api";
import { getBrandLogoUrl } from "../../../lib/assets";
import {
  buildDashboardQueryString,
  buildKioskHref,
  buildPresetHref,
  buildTvModeHref,
  resolveDashboardFilters,
} from "../../../lib/dashboard-filters";

type CallCenterSummaryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function SummaryMetric(props: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <article className="call-center-summary__metric border border-[#e9e2d9] bg-[#fbfbfd] text-center shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="call-center-summary__metric-label font-bold leading-tight text-[#555]">
        {props.label}
      </div>
      <div
        className={`call-center-summary__metric-value font-black leading-none tracking-tight ${
          props.accent ? "text-[#1b66c9]" : "text-[#202028]"
        }`}
      >
        {props.value}
      </div>
    </article>
  );
}

export default async function CallCenterSummaryPage({
  searchParams,
}: CallCenterSummaryPageProps) {
  const filters = await resolveDashboardFilters(
    searchParams,
    "America/Los_Angeles",
    "/call-center/summary",
  );
  const tvMode = filters.tvMode;
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
    {
      label: "Inbound Calls Booked",
      value: String(data.summary.inboundBooked),
    },
    {
      label: "Call Booking Rate",
      value: formatPercent(data.summary.bookingRate),
      accent: true,
    },
    { label: "Manual Calls Booked", value: String(data.summary.manualBooked) },
    { label: "Total Jobs Booked", value: String(data.summary.totalJobs) },
    {
      label: "Cancelled Before Dispatch",
      value: String(data.summary.cancelledBeforeDispatch),
    },
    {
      label: "Cancellation %",
      value: formatPercent(data.summary.cancellationRate),
      accent: true,
    },
  ];

  return (
    <DashboardShell
      title="Call Center Performance Summary"
      subtitle="Call center summary board"
      navItems={navItems}
      activePath="/call-center/summary"
      brandLogoUrl={getBrandLogoUrl()}
      tvMode={tvMode}
      kioskMode={filters.kioskMode}
      navQueryString={buildDashboardQueryString(filters)}
      tvMenu={{
        enabled: filters.tvMode,
        toggleHref: buildTvModeHref(
          "/call-center/summary",
          filters,
          !filters.tvMode,
        ),
        kioskMode: filters.kioskMode,
        kioskHref: buildKioskHref(
          "/call-center/summary",
          filters,
          !filters.kioskMode,
        ),
      }}
      contentClassName={
        "call-center-summary__main"
      }
      headerContent={
        <div className="dashboard-header-tools flex flex-wrap items-center justify-end">
          <FilterBar
            from={filters.fromLabel}
            to={filters.toLabel}
            presets={[
              {
                label: "YTD",
                href: buildPresetHref("/call-center/summary", "ytd", filters),
                active: filters.preset === "ytd",
              },
              {
                label: "MTD",
                href: buildPresetHref("/call-center/summary", "mtd", filters),
                active: filters.preset === "mtd",
              },
            ]}
          />
          <DataFreshnessBadge value={data.snapshotTime} />
        </div>
      }
    >
      <div className="call-center-summary flex h-full min-h-0 flex-col">
        {data.snapshotTime ? (
          <section className="call-center-summary__panel border border-[#ebe2d8] bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfaf8_100%)] shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
            <h2 className="call-center-summary__title text-center font-black tracking-tight text-[#2f3036]">
              Call Center Performance Summary
            </h2>

            <div className="call-center-summary__grid grid md:grid-cols-2 xl:grid-cols-4 3xl:grid-cols-7">
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
