import type { ReactNode } from "react";
import {
  CapacityBars,
  DashboardShell,
  DataFreshnessBadge,
  EmptyDashboardState,
  FilterBar
} from "@irbis/ui";
import { formatCompactCurrency, formatCurrency } from "@irbis/utils";
import { navItems } from "../lib/api";
import {
  buildDashboardQueryString,
  buildKioskHref,
  buildPresetHref,
  buildRotationHref,
  buildTvModeHref,
  type ResolvedDashboardFilters
} from "../lib/dashboard-filters";
import { getBrandLogoUrl } from "../lib/assets";
import { CompanyWideGoalInsertButton } from "./company-wide-goal-insert-button";

type CompanyWideData = {
  marketing: {
    rows: Array<{ label: string; value: number }>;
    snapshotTime?: string | null;
  };
  capacity: {
    rows: Array<{
      businessUnit: string;
      capacityPct: number;
      scheduledHours: number;
      targetHours: number;
    }>;
    snapshotTime?: string | null;
  };
  jobCostingSummary: {
    goal: number;
    mtd: number;
    remainingToGoal: number;
    percentToGoal: number;
    snapshotTime?: string | null;
  };
  revenueGoals: {
    totals: { monthlyGoal: number; yearlyGoal: number };
    monthTotalRevenue: number;
    yearTotalRevenue: number;
    pct: number;
    snapshotTime?: string | null;
  };
  salesToday: { totals: { totalSales: number; totalRevenue: number }; snapshotTime?: string | null };
  salesYesterday: { totals: { totalSales: number; totalRevenue: number }; snapshotTime?: string | null };
  salesMonthlyPace: { pace: number; totalSalesToDate: number; snapshotTime?: string | null };
  revenueMonthlyPace: { value: number; snapshotTime?: string | null };
  bookingRate: {
    kpis: { leads: number; booked: number; unbooked: number; rate: number };
    snapshotTime?: string | null;
  };
  trending: {
    years: {
      previous: number;
      current: number;
    };
    months: Array<{
      month: string;
      short?: string;
      previous: { sales: number; revenue: number };
      current: { sales: number; revenue: number };
      goal: number;
    }>;
    chartMax?: number;
    snapshotTime?: string | null;
  };
  goals: Array<{
    year: number;
    monthIndex: number;
    monthName: string;
    goalAmount: number;
    updatedAt: string;
  }>;
};

type CompanyWidePageProps = {
  data: CompanyWideData;
  filters: ResolvedDashboardFilters;
};

const MARKETING_COLORS = ["#18b3ad", "#4c56d7", "#ff8a1f", "#de4a89", "#7b79ff"];

function Panel(props: {
  title?: string;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <section
      className={`company-panel rounded-[1rem] border border-[#ece3da] bg-[linear-gradient(180deg,_#ffffff_0%,_#fcfbf8_100%)] px-4 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] 3xl:px-5 3xl:py-5 4xl:px-6 4xl:py-6 5xl:px-7 5xl:py-7 ${props.className ?? ""}`}
    >
      {props.title ? (
        <div
          className={`company-panel__title font-black uppercase tracking-tight text-[#111827] ${
            props.titleClassName ?? "text-[1rem] md:text-[1.1rem] 3xl:text-[1.2rem] 4xl:text-[1.32rem] 5xl:text-[1.5rem]"
          }`}
        >
          {props.title}
        </div>
      ) : null}
      <div className={props.title ? "mt-4" : undefined}>{props.children}</div>
    </section>
  );
}

function ProgressBar(props: { value: number; colorClassName?: string }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-[#e8edf3]">
      <div
        className={`h-full rounded-full ${props.colorClassName ?? "bg-[#0b8ca0]"}`}
        style={{ width: `${Math.min(Math.max(props.value * 100, 0), 100)}%` }}
      />
    </div>
  );
}

function percentLabel(value: number) {
  return `${Math.round(value * 100)}%`;
}

function axisCurrency(value: number) {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`;
  }

  return `$${Math.round(value)}`;
}

function trendBarHeight(value: number, max: number) {
  if (value <= 0 || max <= 0) {
    return "0%";
  }

  return `${Math.max((value / max) * 100, 2)}%`;
}

function goalMarkerBottom(goal: number, max: number) {
  if (max <= 0) {
    return "0%";
  }

  const ratio = Math.max(goal, 0) / max;
  return `${Math.max(0, Math.min(ratio, 1)) * 100}%`;
}

function StatBlock(props: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 3xl:text-[11px] 5xl:text-[12px]">
        {props.label}
      </div>
      <div className={`mt-1 text-[0.98rem] font-black md:text-[1.05rem] 3xl:text-[1.12rem] 4xl:text-[1.22rem] 5xl:text-[1.38rem] ${props.accent ? "text-[#fa6e18]" : "text-[#1f2937]"}`}>
        {props.value}
      </div>
    </div>
  );
}

export function CompanyWidePage({ data, filters }: CompanyWidePageProps) {
  const tvMode = filters.tvMode;
  const yearlyGoal =
    data.goals.reduce((sum, goal) => sum + goal.goalAmount, 0) ||
    data.revenueGoals.totals.yearlyGoal;
  const ytdRevenue = data.revenueGoals.yearTotalRevenue;
  const businessYearStart = new Date(`${filters.to.slice(0, 4)}-01-01T00:00:00.000Z`);
  const businessToDate = new Date(`${filters.to}T00:00:00.000Z`);
  const daysElapsed =
    Math.max(1, Math.floor((businessToDate.getTime() - businessYearStart.getTime()) / 86_400_000) + 1);
  const revenuePacing = daysElapsed > 0 ? ytdRevenue * (356 / daysElapsed) : 0;
  const trendMax =
    data.trending.chartMax ||
    Math.max(
      1,
      ...data.trending.months.flatMap((month) => [
        month.previous.sales,
        month.previous.revenue,
        month.current.sales,
        month.current.revenue,
        month.goal
      ]),
    );
  const trendTicks = Array.from({ length: 5 }, (_, index) => trendMax * ((4 - index) / 4));
  const freshness =
    data.trending.snapshotTime ??
    data.revenueGoals.snapshotTime ??
    data.salesToday.snapshotTime ??
    data.bookingRate.snapshotTime ??
    null;
  const hasCachedData = Boolean(freshness);
  const marketingTotal = data.marketing.rows.reduce((sum, row) => sum + row.value, 0);
  let marketingOffset = 0;
  const marketingRows = data.marketing.rows.map((row, index) => {
    const share = marketingTotal > 0 ? row.value / marketingTotal : 0;
    const start = marketingOffset;
    const end = marketingOffset + share * 100;
    marketingOffset = end;

    return {
      ...row,
      name: row.label.split(" - ")[0] ?? row.label,
      share,
      start,
      end,
      color: MARKETING_COLORS[index % MARKETING_COLORS.length] ?? MARKETING_COLORS[0] ?? "#18b3ad"
    };
  });
  const marketingGradient = marketingRows.length
    ? marketingRows
        .map((row) => `${row.color} ${row.start.toFixed(2)}% ${row.end.toFixed(2)}%`)
        .join(", ")
    : "#e8edf3 0% 100%";
  const topMarketingRow = marketingRows[0] ?? null;
  const bookingPct = Math.max(0, Math.min(data.bookingRate.kpis.rate, 1));
  const grossMarginScaleMax = 700_000;
  const grossMarginScalePct = Math.max(
    0,
    Math.min((data.jobCostingSummary.mtd / grossMarginScaleMax) * 100, 100),
  );
  const grossMarginGoalPct = Math.max(
    0,
    Math.min(
      data.jobCostingSummary.goal > 0
        ? (data.jobCostingSummary.mtd / data.jobCostingSummary.goal) * 100
        : 0,
      100,
    ),
  );
  const remainingGrossMargin = Math.max(
    0,
    data.jobCostingSummary.goal - data.jobCostingSummary.mtd,
  );

  return (
    <DashboardShell
      title="Company-wide Dashboard"
      subtitle="Company-wide operating board"
      navItems={navItems}
      activePath="/company-wide"
      brandLogoUrl={getBrandLogoUrl()}
      tvMode={tvMode}
      kioskMode={filters.kioskMode}
      navQueryString={buildDashboardQueryString(filters)}
      tvMenu={{
        enabled: tvMode,
        toggleHref: buildTvModeHref("/company-wide", filters, !tvMode),
        kioskMode: filters.kioskMode,
        kioskHref: buildKioskHref("/company-wide", filters, !filters.kioskMode),
        rotateMode: filters.rotateMode,
        rotatePreset: filters.preset,
        rotateOffHref: buildRotationHref("/company-wide", filters, filters.preset, false),
        rotateMtdHref: buildRotationHref("/company-wide", filters, "mtd", true),
        rotateYtdHref: buildRotationHref("/company-wide", filters, "ytd", true)
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
                href: buildPresetHref("/company-wide", "ytd", filters),
                active: filters.preset === "ytd"
              },
              {
                label: "MTD",
                href: buildPresetHref("/company-wide", "mtd", filters),
                active: filters.preset === "mtd"
              }
            ]}
          />
          <DataFreshnessBadge value={freshness} />
        </div>
      }
    >
      <div className={`company-wide-page flex flex-col gap-3 ${tvMode ? "company-wide-page--tv h-full min-h-0" : ""}`}>
        {hasCachedData ? (
          <div
            className={`company-board ${tvMode ? "company-board--tv" : ""} grid gap-3 3xl:gap-4 4xl:gap-5 5xl:gap-6 ${
              tvMode
                ? "h-full min-h-0 items-stretch xl:grid-cols-[minmax(0,1.94fr)_minmax(29rem,0.72fr)] 4xl:grid-cols-[minmax(0,2.02fr)_minmax(34rem,0.62fr)] 5xl:grid-cols-[minmax(0,2.12fr)_minmax(40rem,0.54fr)]"
                : "items-start xl:grid-cols-[minmax(0,1.62fr)_minmax(20rem,0.88fr)] 2xl:grid-cols-[minmax(0,1.68fr)_minmax(21rem,0.92fr)] 3xl:grid-cols-[minmax(0,1.8fr)_minmax(25rem,0.8fr)] 4xl:grid-cols-[minmax(0,1.92fr)_minmax(31rem,0.68fr)] 5xl:grid-cols-[minmax(0,2.02fr)_minmax(36rem,0.58fr)]"
            }`}
          >
            <div
              className={`company-board__left grid gap-3 ${tvMode ? "h-full min-h-0 grid-rows-[minmax(0,1.52fr)_minmax(0,1fr)]" : ""}`}
            >
              <section className={`company-board__trending-section ${tvMode ? "h-full" : ""}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className={`company-board__section-title font-black uppercase leading-none tracking-tight text-[#111827] ${
                    tvMode
                      ? "text-[1.5rem] 3xl:text-[1.8rem] 4xl:text-[2.2rem] 5xl:text-[2.5rem]"
                      : "text-[1.15rem] md:text-[1.35rem] 3xl:text-[1.5rem] 4xl:text-[1.72rem] 5xl:text-[1.95rem]"
                  }`}>
                    Trending
                  </div>
                  <CompanyWideGoalInsertButton
                    goals={data.goals}
                    year={data.trending.years.current}
                  />
                </div>
                <Panel className={`company-board__trending-panel px-4 py-4 ${tvMode ? "flex h-full min-h-0 flex-col" : ""}`}>
                  <div className={`company-board__legend mb-3 flex flex-wrap gap-2 ${tvMode ? "4xl:gap-3" : ""}`}>
                    <span className={`rounded-full border border-[#eadfd3] bg-[#f7f3ee] px-3 py-1 font-semibold text-[#8b5b3c] ${
                      tvMode
                        ? "text-[0.95rem] 3xl:px-4 3xl:py-2 4xl:text-[1.12rem] 5xl:px-5 5xl:py-2.5 5xl:text-[1.24rem]"
                        : "text-[0.86rem] 3xl:px-3.5 3xl:py-1.5 3xl:text-[0.92rem] 5xl:px-4.5 5xl:py-2 5xl:text-[1.02rem]"
                    }`}>
                      {data.trending.years.previous} Sales
                    </span>
                    <span className={`rounded-full border border-[#eadfd3] bg-[#f7f3ee] px-3 py-1 font-semibold text-[#4a90e2] ${
                      tvMode
                        ? "text-[0.95rem] 3xl:px-4 3xl:py-2 4xl:text-[1.12rem] 5xl:px-5 5xl:py-2.5 5xl:text-[1.24rem]"
                        : "text-[0.86rem] 3xl:px-3.5 3xl:py-1.5 3xl:text-[0.92rem] 5xl:px-4.5 5xl:py-2 5xl:text-[1.02rem]"
                    }`}>
                      {data.trending.years.previous} Revenue
                    </span>
                    <span className={`rounded-full border border-[#d7efe8] bg-[#eefaf7] px-3 py-1 font-semibold text-[#ff6b35] ${
                      tvMode
                        ? "text-[0.95rem] 3xl:px-4 3xl:py-2 4xl:text-[1.12rem] 5xl:px-5 5xl:py-2.5 5xl:text-[1.24rem]"
                        : "text-[0.86rem] 3xl:px-3.5 3xl:py-1.5 3xl:text-[0.92rem] 5xl:px-4.5 5xl:py-2 5xl:text-[1.02rem]"
                    }`}>
                      {data.trending.years.current} Sales
                    </span>
                    <span className={`rounded-full border border-[#d7efe8] bg-[#eefaf7] px-3 py-1 font-semibold text-[#17b4b0] ${
                      tvMode
                        ? "text-[0.95rem] 3xl:px-4 3xl:py-2 4xl:text-[1.12rem] 5xl:px-5 5xl:py-2.5 5xl:text-[1.24rem]"
                        : "text-[0.86rem] 3xl:px-3.5 3xl:py-1.5 3xl:text-[0.92rem] 5xl:px-4.5 5xl:py-2 5xl:text-[1.02rem]"
                    }`}>
                      {data.trending.years.current} Revenue
                    </span>
                  </div>

                  <div
                    className={`company-board__trend-frame rounded-[1rem] border border-[#edf0f4] bg-[#f8fbff] p-3.5 3xl:p-4 4xl:p-5 5xl:p-6 ${
                      tvMode ? "flex-1 min-h-0" : ""
                    }`}
                  >
                    <div className={`grid gap-3 md:grid-cols-[52px_minmax(0,1fr)] 3xl:grid-cols-[60px_minmax(0,1fr)] 4xl:grid-cols-[78px_minmax(0,1fr)] 5xl:grid-cols-[90px_minmax(0,1fr)] 3xl:gap-4 5xl:gap-5 ${
                      tvMode ? "h-full min-h-0" : ""
                    }`}>
                      <div className={`relative ${
                        tvMode ? "h-full min-h-[18rem] 3xl:min-h-[22rem] 4xl:min-h-[26rem] 5xl:min-h-[30rem]" : "h-56 2xl:h-64 3xl:h-72 4xl:h-96 5xl:h-[28rem]"
                      }`}>
                        {trendTicks.map((tick, index) => (
                          <div
                            className="absolute left-0 right-0 flex -translate-y-1/2 items-center text-xs font-bold text-slate-500 3xl:text-[13px] 4xl:text-[15px] 5xl:text-[17px]"
                            key={`${tick}-${index}`}
                            style={{ top: `${(index / (trendTicks.length - 1)) * 100}%` }}
                          >
                            {axisCurrency(tick)}
                          </div>
                        ))}
                      </div>

                      <div className={`relative grid min-h-0 ${
                        tvMode
                          ? "h-full grid-rows-[minmax(0,1fr)_1.9rem] 3xl:grid-rows-[minmax(0,1fr)_2.2rem] 4xl:grid-rows-[minmax(0,1fr)_2.6rem] 5xl:grid-rows-[minmax(0,1fr)_3rem]"
                          : "h-56 grid-rows-[minmax(0,1fr)_1.35rem] 2xl:h-64 2xl:grid-rows-[minmax(0,1fr)_1.5rem] 3xl:h-72 3xl:grid-rows-[minmax(0,1fr)_1.7rem] 4xl:h-96 4xl:grid-rows-[minmax(0,1fr)_2.1rem] 5xl:h-[28rem] 5xl:grid-rows-[minmax(0,1fr)_2.4rem]"
                      }`}>
                        <div className="absolute inset-0">
                          {trendTicks.map((_, index) => (
                            <div
                              className="absolute left-0 right-0 border-t border-[#dbe6f4]"
                              key={index}
                              style={{ top: `${(index / (trendTicks.length - 1)) * 100}%` }}
                            />
                          ))}
                        </div>

                        <div className="grid grid-cols-12 gap-1.5 3xl:gap-2 5xl:gap-2.5">
                          {data.trending.months.map((month) => (
                            <div className="relative flex h-full items-end justify-center gap-1 4xl:gap-1.5" key={month.month}>
                              <div
                                className="absolute left-1/2 w-[84%] -translate-x-1/2 rounded-full bg-[#42d14a] 3xl:h-[0.42rem] 5xl:h-[0.5rem]"
                                style={{
                                  bottom: goalMarkerBottom(month.goal, trendMax),
                                  height: "0.36rem"
                                }}
                              />
                              <div className="w-1.5 rounded-full bg-[#8b5b3c] 3xl:w-2 5xl:w-2.5" style={{ height: trendBarHeight(month.previous.sales, trendMax) }} />
                              <div
                                className="w-1.5 rounded-full bg-[#4a90e2] 3xl:w-2 5xl:w-2.5"
                                style={{ height: trendBarHeight(month.previous.revenue, trendMax) }}
                              />
                              <div
                                className="w-1.5 rounded-full bg-[#ff6b35] 3xl:w-2 5xl:w-2.5"
                                style={{ height: trendBarHeight(month.current.sales, trendMax) }}
                              />
                              <div
                                className="w-1.5 rounded-full bg-[#17b4b0] 3xl:w-2 5xl:w-2.5"
                                style={{ height: trendBarHeight(month.current.revenue, trendMax) }}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-12 gap-1.5 pt-1 3xl:gap-2 3xl:pt-1.5 5xl:gap-2.5 5xl:pt-2">
                          {data.trending.months.map((month) => (
                            <div
                              className="text-center text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 3xl:text-[12px] 4xl:text-[13px] 5xl:text-[15px]"
                              key={`${month.month}-label`}
                            >
                              {month.short ?? month.month.slice(0, 3)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>
              </section>

              <div className={`company-board__lower grid items-stretch gap-3 3xl:gap-4 5xl:gap-5 ${
                tvMode
                  ? "h-full min-h-0 xl:grid-cols-[minmax(0,1.68fr)_minmax(24rem,0.78fr)] 4xl:grid-cols-[minmax(0,1.84fr)_minmax(28rem,0.66fr)] 5xl:grid-cols-[minmax(0,1.98fr)_minmax(32rem,0.58fr)]"
                  : "xl:grid-cols-[minmax(0,1.28fr)_minmax(16rem,0.82fr)] 2xl:grid-cols-[minmax(0,1.34fr)_minmax(17rem,0.78fr)] 3xl:grid-cols-[minmax(0,1.52fr)_minmax(20rem,0.66fr)] 4xl:grid-cols-[minmax(0,1.7fr)_minmax(24rem,0.55fr)] 5xl:grid-cols-[minmax(0,1.84fr)_minmax(27rem,0.48fr)]"
              }`}>
                <Panel className="company-board__marketing h-full" title="Marketing">
                  {marketingRows.length > 0 ? (
                    <div className={`grid h-full min-h-0 gap-5 3xl:gap-6 ${
                      tvMode
                        ? "lg:grid-cols-[18rem_minmax(0,1fr)] 4xl:grid-cols-[21rem_minmax(0,1fr)] 5xl:grid-cols-[24rem_minmax(0,1fr)]"
                        : "lg:grid-cols-[12rem_minmax(0,1fr)] 3xl:grid-cols-[14rem_minmax(0,1fr)] 4xl:grid-cols-[15rem_minmax(0,1fr)]"
                    }`}>
                      <div className="flex flex-col justify-center gap-4">
                          <div className="mx-auto">
                            <div
                              className={`relative rounded-full ${
                                tvMode
                                  ? "h-[11rem] w-[11rem] 3xl:h-[13rem] 3xl:w-[13rem] 4xl:h-[15rem] 4xl:w-[15rem] 5xl:h-[17rem] 5xl:w-[17rem]"
                                  : "h-28 w-28 md:h-[7.5rem] md:w-[7.5rem] 3xl:h-[8.5rem] 3xl:w-[8.5rem] 4xl:h-[9.5rem] 4xl:w-[9.5rem]"
                              }`}
                              style={{ background: `conic-gradient(${marketingGradient})` }}
                            >
                              <div className={`absolute rounded-full bg-white ${tvMode ? "inset-[1.35rem]" : "inset-[1rem]"}`} />
                            </div>
                          </div>

                        <div className={`grid gap-2 ${tvMode ? "4xl:gap-3" : ""}`}>
                          <div className={`rounded-[0.9rem] bg-[#f8fbfd] ${tvMode ? "px-4 py-4 4xl:px-5 4xl:py-5" : "px-3 py-3"}`}>
                            <div className={`font-bold uppercase tracking-[0.18em] text-slate-500 ${tvMode ? "text-[11px] 4xl:text-[12px] 5xl:text-[13px]" : "text-[10px]"}`}>
                              Total Attributed
                            </div>
                            <div className={`mt-1 font-black text-[#1f2937] ${tvMode ? "text-[1.3rem] 4xl:text-[1.55rem] 5xl:text-[1.8rem]" : "text-[1.05rem] 3xl:text-[1.18rem]"}`}>
                              {formatCompactCurrency(marketingTotal, 1)}
                            </div>
                          </div>
                          <div className={`rounded-[0.9rem] bg-[#f8fbfd] ${tvMode ? "px-4 py-4 4xl:px-5 4xl:py-5" : "px-3 py-3"}`}>
                            <div className={`font-bold uppercase tracking-[0.18em] text-slate-500 ${tvMode ? "text-[11px] 4xl:text-[12px] 5xl:text-[13px]" : "text-[10px]"}`}>
                              Top Source
                            </div>
                            <div className={`mt-1 truncate font-black text-[#00363e] ${tvMode ? "text-[1.1rem] 4xl:text-[1.32rem] 5xl:text-[1.55rem]" : "text-[0.95rem] 3xl:text-[1rem]"}`}>
                              {topMarketingRow?.name ?? "N/A"}
                            </div>
                            <div className={`mt-1 font-bold text-[#18b3ad] ${tvMode ? "text-[0.95rem] 4xl:text-[1.05rem] 5xl:text-[1.12rem]" : "text-sm 3xl:text-[0.95rem]"}`}>
                              {topMarketingRow ? `${Math.round(topMarketingRow.share * 100)}% share` : ""}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className={`grid content-center gap-2.5 3xl:gap-3 ${tvMode ? "4xl:gap-4" : ""}`}>
                        {marketingRows.slice(0, 5).map((row) => (
                          <div
                            className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[0.85rem] bg-[#fcfcfd] ${
                              tvMode ? "px-4 py-3.5 4xl:px-5 4xl:py-4.5" : "px-3 py-2.5 3xl:px-3.5 3xl:py-3"
                            }`}
                            key={row.label}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className="inline-flex h-3 w-3 rounded-full"
                                style={{ backgroundColor: row.color }}
                              />
                              <div className="min-w-0">
                                <div className={`truncate font-semibold text-[#00363e] ${tvMode ? "text-[15px] 4xl:text-[17px] 5xl:text-[19px]" : "text-[13px] 3xl:text-[14px]"}`}>
                                  {row.name}
                                </div>
                                <div className={`font-medium text-slate-500 ${tvMode ? "text-[12px] 4xl:text-[13px] 5xl:text-[14px]" : "text-[11px] 3xl:text-[12px]"}`}>
                                  {Math.round(row.share * 100)}% of attributed revenue
                                </div>
                              </div>
                            </div>
                            <div className={`text-right font-black text-[#1f2937] ${tvMode ? "text-[15px] 4xl:text-[17px] 5xl:text-[19px]" : "text-[13px] 3xl:text-[14px]"}`}>
                              {formatCompactCurrency(row.value, 1)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[12rem] items-center justify-center text-sm text-slate-500">
                      No marketing rows available.
                    </div>
                  )}
                </Panel>

                <div className={`company-board__support grid h-full min-h-0 gap-3 3xl:gap-4 ${
                  tvMode ? "grid-rows-[minmax(0,0.92fr)_minmax(0,1.08fr)]" : "xl:grid-rows-[minmax(0,0.94fr)_minmax(0,1.06fr)]"
                }`}>
                  <Panel className="company-board__calls h-full" title="Calls">
                    <div className={`grid h-full min-h-0 items-center gap-4 3xl:gap-5 ${
                      tvMode ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-[auto_minmax(0,1fr)]"
                    }`}>
                      <div
                        className={`relative flex items-center justify-center rounded-full ${
                          tvMode ? "h-28 w-28 3xl:h-32 3xl:w-32 4xl:h-36 4xl:w-36 5xl:h-40 5xl:w-40" : "h-24 w-24 3xl:h-28 3xl:w-28 4xl:h-32 4xl:w-32"
                        }`}
                        style={{
                          background: `conic-gradient(#0b8b4f ${bookingPct * 360}deg, #d7fbef 0deg)`
                        }}
                      >
                        <div className="absolute inset-[0.7rem] rounded-full bg-white shadow-inner" />
                        <div className="absolute text-center">
                          <div className="text-[1.7rem] font-black tracking-tight text-[#111827] 3xl:text-[1.95rem] 4xl:text-[2.15rem]">
                            {percentLabel(data.bookingRate.kpis.rate)}
                          </div>
                        </div>
                      </div>

                        <div className={`grid gap-2 ${tvMode ? "4xl:gap-3" : ""}`}>
                        <div className={`grid grid-cols-3 text-center ${tvMode ? "gap-3 4xl:gap-4" : "gap-2"}`}>
                          <div className="rounded-[0.85rem] bg-[#f8fbfd] px-2 py-2.5">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Leads</div>
                            <div className="mt-1 text-lg font-black text-[#1f2937] 3xl:text-[1.35rem]">
                              {data.bookingRate.kpis.leads}
                            </div>
                          </div>
                          <div className="rounded-[0.85rem] bg-[#f8fbfd] px-2 py-2.5">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Booked</div>
                            <div className="mt-1 text-lg font-black text-[#1f2937] 3xl:text-[1.35rem]">
                              {data.bookingRate.kpis.booked}
                            </div>
                          </div>
                          <div className="rounded-[0.85rem] bg-[#f8fbfd] px-2 py-2.5">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Open</div>
                            <div className="mt-1 text-lg font-black text-[#1f2937] 3xl:text-[1.35rem]">
                              {data.bookingRate.kpis.unbooked}
                            </div>
                          </div>
                        </div>
                        <div className={`text-slate-500 ${tvMode ? "text-[13px] 4xl:text-[14px] 5xl:text-[15px]" : "text-[12px] 3xl:text-[13px]"}`}>
                          Based on the latest booking snapshot for the selected date scope.
                        </div>
                      </div>
                    </div>
                  </Panel>

                  <div className="h-full">
                    <CapacityBars rows={data.capacity.rows.slice(0, 4)} />
                  </div>
                </div>
              </div>
            </div>

            <div className={`company-board__right-rail grid gap-3 ${tvMode ? "h-full min-h-0 grid-rows-[repeat(4,minmax(0,1fr))]" : ""}`}>
              <Panel className="company-board__sales-panel" title="Sales">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                  <div className="rounded-[1rem] bg-[#f8fbfd] px-4 py-3.5">
                    <div className="text-center text-[12px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Today
                    </div>
                    <div className="mt-3 grid gap-3">
                      <StatBlock
                        label="Total Sales"
                        value={formatCurrency(data.salesToday.totals.totalSales)}
                      />
                      <StatBlock
                        accent={true}
                        label="Total Revenue"
                        value={formatCurrency(data.salesToday.totals.totalRevenue)}
                      />
                    </div>
                  </div>

                  <div className="rounded-[1rem] bg-[#f8fbfd] px-4 py-3.5">
                    <div className="text-center text-[12px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Yesterday
                    </div>
                    <div className="mt-3 grid gap-3">
                      <StatBlock
                        label="Total Sales"
                        value={formatCurrency(data.salesYesterday.totals.totalSales)}
                      />
                      <StatBlock
                        accent={true}
                        label="Total Revenue"
                        value={formatCurrency(data.salesYesterday.totals.totalRevenue)}
                      />
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel className="company-board__goal-panel" title="Goal Tracker">
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <ProgressBar value={yearlyGoal > 0 ? ytdRevenue / yearlyGoal : 0} />
                  </div>
                  <div className="text-[1.55rem] font-black text-[#fa6e18] 3xl:text-[1.7rem]">
                    {percentLabel(yearlyGoal > 0 ? ytdRevenue / yearlyGoal : 0)}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <StatBlock label="Revenue (YTD)" value={formatCompactCurrency(ytdRevenue, 1)} />
                  <StatBlock accent={true} label="Pacing" value={formatCompactCurrency(revenuePacing, 1)} />
                  <StatBlock label="Goal" value={formatCompactCurrency(yearlyGoal, 1)} />
                </div>
              </Panel>

              <Panel className="company-board__gross-panel" title="Company Jobs Gross Margin Goal Tracker" titleClassName="text-[1.05rem] md:text-[1.2rem]">
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatBlock label="Monthly Goal" value={formatCurrency(data.jobCostingSummary.goal)} />
                  <StatBlock label="MTD Gross Margin" value={formatCurrency(data.jobCostingSummary.mtd)} />
                  <StatBlock label="Remaining" value={formatCurrency(remainingGrossMargin)} />
                </div>

                <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between gap-4 text-[0.95rem] font-black text-[#111827] 3xl:text-[1.02rem]">
                    <span>MTD</span>
                    <span>
                      {formatCurrency(data.jobCostingSummary.mtd)}{" "}
                      <span className="text-sm text-slate-500">
                        {percentLabel(data.jobCostingSummary.percentToGoal)}
                      </span>
                    </span>
                  </div>

                    <div className="relative h-5 overflow-hidden rounded-full bg-[#eef2f6]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[#2683a3]"
                      style={{ width: `${grossMarginScalePct}%` }}
                    />
                    <div
                      className="absolute inset-y-0 w-[2px] bg-[#c8d0d9]"
                      style={{ left: `${(500_000 / grossMarginScaleMax) * 100}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-10 w-[2px] -translate-y-1/2 bg-[#7c8288]"
                      style={{ left: `${grossMarginGoalPct}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>0</span>
                    <span>500k</span>
                    <span>700k</span>
                  </div>
                </div>
              </Panel>

              <Panel className="company-board__pace-panel" title="Monthly Pace">
                <div className="space-y-4">
                  <div>
                  <div className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#111827]">
                      Company Revenue Monthly Pace
                    </div>
                    <div className="rounded-[0.8rem] bg-[#fa6e18] px-4 py-2.5 text-center text-[1.15rem] font-black text-white 3xl:text-[1.28rem] 4xl:text-[1.34rem]">
                      {formatCompactCurrency(data.revenueMonthlyPace.value, 2)}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#111827]">
                      Company Sales Monthly Pace
                    </div>
                    <div className="rounded-[0.8rem] bg-[#fa6e18] px-4 py-2.5 text-center text-[1.15rem] font-black text-white 3xl:text-[1.28rem] 4xl:text-[1.34rem]">
                      {formatCompactCurrency(data.salesMonthlyPace.pace, 2)}
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        ) : (
          <EmptyDashboardState
            title="No cached company-wide snapshot for this range yet"
            description="The API queued a background refresh for this filter scope. The page will populate once the worker stores the real snapshot set for the selected range."
          />
        )}
      </div>
    </DashboardShell>
  );
}
