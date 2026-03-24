import { DashboardShell, DataFreshnessBadge, EmptyDashboardState, FilterBar } from "@irbis/ui";
import { formatPercent } from "@irbis/utils";
import { navItems, fetchApi } from "../../../lib/api";
import { getBrandLogoUrl } from "../../../lib/assets";
import {
  buildDashboardQueryString,
  buildKioskHref,
  buildPresetHref,
  buildRotationHref,
  buildTvModeHref,
  resolveDashboardFilters
} from "../../../lib/dashboard-filters";

type CallCenterSummaryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function SummaryMetric(props: { label: string; value: string; accent?: boolean; tvMode?: boolean }) {
  if (props.tvMode) {
    return (
      <article className="call-center-tv-metric flex h-full flex-col justify-center rounded-[1rem] border border-[#e9e2d9] bg-[#fbfbfd] px-4 py-4 text-center shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <div className="call-center-tv-metric__label text-[0.88rem] font-bold leading-tight text-[#555]">
          {props.label}
        </div>
        <div
          className={`call-center-tv-metric__value mt-3 text-[1.8rem] font-black leading-none tracking-tight ${
            props.accent ? "text-[#1b66c9]" : "text-[#202028]"
          }`}
        >
          {props.value}
        </div>
      </article>
    );
  }

  return (
    <article className="call-center-summary__metric rounded-[1rem] border border-[#e9e2d9] bg-[#fbfbfd] px-4 py-4 text-center shadow-[0_6px_16px_rgba(15,23,42,0.04)] 3xl:px-5 3xl:py-5">
      <div className="call-center-summary__metric-label text-[0.88rem] font-bold leading-tight text-[#555] md:text-[0.92rem] 3xl:text-[0.98rem]">
        {props.label}
      </div>
      <div
        className={`call-center-summary__metric-value mt-3 text-[1.8rem] font-black leading-none tracking-tight md:text-[2rem] 3xl:text-[2.15rem] 4xl:text-[2.3rem] ${
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
      tvMode={tvMode}
      kioskMode={filters.kioskMode}
      navQueryString={buildDashboardQueryString(filters)}
      tvMenu={{
        enabled: filters.tvMode,
        toggleHref: buildTvModeHref("/call-center/summary", filters, !filters.tvMode),
        kioskMode: filters.kioskMode,
        kioskHref: buildKioskHref("/call-center/summary", filters, !filters.kioskMode),
        rotateMode: filters.rotateMode,
        rotatePreset: filters.preset,
        rotateOffHref: buildRotationHref("/call-center/summary", filters, filters.preset, false),
        rotateMtdHref: buildRotationHref("/call-center/summary", filters, "mtd", true),
        rotateYtdHref: buildRotationHref("/call-center/summary", filters, "ytd", true)
      }}
      contentClassName={
        tvMode
          ? "min-h-[calc(100dvh-7.5rem)] 4xl:min-h-[calc(100dvh-8.5rem)] 5xl:min-h-[calc(100dvh-9.5rem)]"
          : undefined
      }
      headerContent={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <FilterBar
            from={filters.fromLabel}
            to={filters.toLabel}
            presets={[
              {
                label: "YTD",
                href: buildPresetHref("/call-center/summary", "ytd", filters),
                active: filters.preset === "ytd"
              },
              {
                label: "MTD",
                href: buildPresetHref("/call-center/summary", "mtd", filters),
                active: filters.preset === "mtd"
              }
            ]}
          />
          <DataFreshnessBadge value={data.snapshotTime} />
        </div>
      }
    >
      <div className={`call-center-summary flex flex-col gap-3 ${tvMode ? "call-center-summary--tv h-full min-h-0" : ""}`}>
        {data.snapshotTime ? (
          tvMode ? (
            <section className="call-center-tv-board flex-1 min-h-0 rounded-[1rem] border border-[#ebe2d8] bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfaf8_100%)] px-5 py-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <h2 className="call-center-tv-title text-center font-black tracking-tight text-[#2f3036]">
                Call Center Performance Summary
              </h2>

              <div className="call-center-tv-rows mt-5">
                <div className="call-center-tv-row call-center-tv-row--primary">
                  {metrics.slice(0, 4).map((metric) => (
                    <SummaryMetric
                      key={metric.label}
                      label={metric.label}
                      tvMode={true}
                      value={metric.value}
                      {...(metric.accent ? { accent: true } : {})}
                    />
                  ))}
                </div>
                <div className="call-center-tv-row call-center-tv-row--secondary">
                  {metrics.slice(4).map((metric) => (
                    <SummaryMetric
                      key={metric.label}
                      label={metric.label}
                      tvMode={true}
                      value={metric.value}
                      {...(metric.accent ? { accent: true } : {})}
                    />
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <section className="call-center-summary__panel rounded-[1rem] border border-[#ebe2d8] bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfaf8_100%)] px-5 py-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)] md:px-6 md:py-6 3xl:px-7 3xl:py-7">
              <h2 className="call-center-summary__title text-center text-[1.55rem] font-black tracking-tight text-[#2f3036] md:text-[1.8rem] 3xl:text-[2rem] 4xl:text-[2.15rem]">
                Call Center Performance Summary
              </h2>

              <div className="call-center-summary__grid mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4 3xl:grid-cols-7 3xl:gap-4">
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
          )
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
