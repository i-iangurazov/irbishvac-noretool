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
import type { ResolvedDashboardFilters } from "../lib/dashboard-filters";
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
      className={`rounded-[1rem] border border-[#ece3da] bg-[linear-gradient(180deg,_#ffffff_0%,_#fcfbf8_100%)] px-4 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] ${props.className ?? ""}`}
    >
      {props.title ? (
        <div
          className={`font-black uppercase tracking-tight text-[#111827] ${
            props.titleClassName ?? "text-[1rem] md:text-[1.1rem]"
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
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {props.label}
      </div>
      <div className={`mt-1 text-[0.98rem] font-black md:text-[1.05rem] ${props.accent ? "text-[#fa6e18]" : "text-[#1f2937]"}`}>
        {props.value}
      </div>
    </div>
  );
}

export function CompanyWidePage({ data, filters }: CompanyWidePageProps) {
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
      headerContent={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <FilterBar
            from={filters.fromLabel}
            to={filters.toLabel}
            presets={[
              { label: "YTD", href: "/company-wide?preset=ytd", active: filters.preset === "ytd" },
              { label: "MTD", href: "/company-wide?preset=mtd", active: filters.preset === "mtd" }
            ]}
          />
          <DataFreshnessBadge value={freshness} />
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {hasCachedData ? (
          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.62fr)_minmax(20rem,0.88fr)]">
            <div className="grid gap-3">
              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[1.15rem] font-black uppercase leading-none tracking-tight text-[#111827] md:text-[1.35rem]">
                    Trending
                  </div>
                  <CompanyWideGoalInsertButton
                    goals={data.goals}
                    year={data.trending.years.current}
                  />
                </div>
                <Panel className="px-4 py-4">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#eadfd3] bg-[#f7f3ee] px-3 py-1 text-[0.86rem] font-semibold text-[#8b5b3c]">
                      {data.trending.years.previous} Sales
                    </span>
                    <span className="rounded-full border border-[#eadfd3] bg-[#f7f3ee] px-3 py-1 text-[0.86rem] font-semibold text-[#4a90e2]">
                      {data.trending.years.previous} Revenue
                    </span>
                    <span className="rounded-full border border-[#d7efe8] bg-[#eefaf7] px-3 py-1 text-[0.86rem] font-semibold text-[#ff6b35]">
                      {data.trending.years.current} Sales
                    </span>
                    <span className="rounded-full border border-[#d7efe8] bg-[#eefaf7] px-3 py-1 text-[0.86rem] font-semibold text-[#17b4b0]">
                      {data.trending.years.current} Revenue
                    </span>
                  </div>

                  <div className="rounded-[1rem] border border-[#edf0f4] bg-[#f8fbff] p-3.5">
                    <div className="grid gap-3 md:grid-cols-[52px_minmax(0,1fr)]">
                      <div className="relative h-56">
                        {trendTicks.map((tick, index) => (
                          <div
                            className="absolute left-0 right-0 flex -translate-y-1/2 items-center text-xs font-bold text-slate-500"
                            key={`${tick}-${index}`}
                            style={{ top: `${(index / (trendTicks.length - 1)) * 100}%` }}
                          >
                            {axisCurrency(tick)}
                          </div>
                        ))}
                      </div>

                      <div className="relative grid h-56 grid-rows-[minmax(0,1fr)_1.35rem]">
                        <div className="absolute inset-0">
                          {trendTicks.map((_, index) => (
                            <div
                              className="absolute left-0 right-0 border-t border-[#dbe6f4]"
                              key={index}
                              style={{ top: `${(index / (trendTicks.length - 1)) * 100}%` }}
                            />
                          ))}
                        </div>

                        <div className="grid grid-cols-12 gap-1.5">
                          {data.trending.months.map((month) => (
                            <div className="relative flex h-full items-end justify-center gap-1" key={month.month}>
                              <div
                                className="absolute left-1/2 w-[82%] -translate-x-1/2 rounded-full bg-[#42d14a]"
                                style={{
                                  bottom: goalMarkerBottom(month.goal, trendMax),
                                  height: "0.36rem"
                                }}
                              />
                              <div
                                className="w-1.5 rounded-full bg-[#8b5b3c]"
                                style={{ height: trendBarHeight(month.previous.sales, trendMax) }}
                              />
                              <div
                                className="w-1.5 rounded-full bg-[#4a90e2]"
                                style={{ height: trendBarHeight(month.previous.revenue, trendMax) }}
                              />
                              <div
                                className="w-1.5 rounded-full bg-[#ff6b35]"
                                style={{ height: trendBarHeight(month.current.sales, trendMax) }}
                              />
                              <div
                                className="w-1.5 rounded-full bg-[#17b4b0]"
                                style={{ height: trendBarHeight(month.current.revenue, trendMax) }}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-12 gap-1.5 pt-1">
                          {data.trending.months.map((month) => (
                            <div
                              className="text-center text-[11px] font-black uppercase tracking-[0.16em] text-slate-500"
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

              <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.28fr)_minmax(16rem,0.82fr)]">
                <Panel className="h-full" title="Marketing">
                  {marketingRows.length > 0 ? (
                    <div className="grid h-full gap-5 lg:grid-cols-[12rem_minmax(0,1fr)]">
                      <div className="flex flex-col justify-center gap-4">
                        <div className="mx-auto">
                          <div
                            className="relative h-28 w-28 rounded-full md:h-[7.5rem] md:w-[7.5rem]"
                            style={{ background: `conic-gradient(${marketingGradient})` }}
                          >
                            <div className="absolute inset-[1rem] rounded-full bg-white" />
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <div className="rounded-[0.9rem] bg-[#f8fbfd] px-3 py-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                              Total Attributed
                            </div>
                            <div className="mt-1 text-[1.05rem] font-black text-[#1f2937]">
                              {formatCompactCurrency(marketingTotal, 1)}
                            </div>
                          </div>
                          <div className="rounded-[0.9rem] bg-[#f8fbfd] px-3 py-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                              Top Source
                            </div>
                            <div className="mt-1 truncate text-[0.95rem] font-black text-[#00363e]">
                              {topMarketingRow?.name ?? "N/A"}
                            </div>
                            <div className="mt-1 text-sm font-bold text-[#18b3ad]">
                              {topMarketingRow ? `${Math.round(topMarketingRow.share * 100)}% share` : ""}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid content-center gap-2.5">
                        {marketingRows.slice(0, 5).map((row) => (
                          <div
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[0.85rem] bg-[#fcfcfd] px-3 py-2.5"
                            key={row.label}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className="inline-flex h-3 w-3 rounded-full"
                                style={{ backgroundColor: row.color }}
                              />
                              <div className="min-w-0">
                                <div className="truncate text-[13px] font-semibold text-[#00363e]">
                                  {row.name}
                                </div>
                                <div className="text-[11px] font-medium text-slate-500">
                                  {Math.round(row.share * 100)}% of attributed revenue
                                </div>
                              </div>
                            </div>
                            <div className="text-right text-[13px] font-black text-[#1f2937]">
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

                <div className="grid h-full gap-3 xl:grid-rows-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
                  <Panel className="h-full" title="Calls">
                    <div className="grid h-full grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
                      <div
                        className="relative flex h-24 w-24 items-center justify-center rounded-full"
                        style={{
                          background: `conic-gradient(#0b8b4f ${bookingPct * 360}deg, #d7fbef 0deg)`
                        }}
                      >
                        <div className="absolute inset-[0.7rem] rounded-full bg-white shadow-inner" />
                        <div className="absolute text-center">
                          <div className="text-[1.7rem] font-black tracking-tight text-[#111827]">
                            {percentLabel(data.bookingRate.kpis.rate)}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-[0.85rem] bg-[#f8fbfd] px-2 py-2.5">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Leads</div>
                            <div className="mt-1 text-lg font-black text-[#1f2937]">
                              {data.bookingRate.kpis.leads}
                            </div>
                          </div>
                          <div className="rounded-[0.85rem] bg-[#f8fbfd] px-2 py-2.5">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Booked</div>
                            <div className="mt-1 text-lg font-black text-[#1f2937]">
                              {data.bookingRate.kpis.booked}
                            </div>
                          </div>
                          <div className="rounded-[0.85rem] bg-[#f8fbfd] px-2 py-2.5">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Open</div>
                            <div className="mt-1 text-lg font-black text-[#1f2937]">
                              {data.bookingRate.kpis.unbooked}
                            </div>
                          </div>
                        </div>
                        <div className="text-[12px] text-slate-500">
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

            <div className="grid gap-3">
              <Panel title="Sales">
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

              <Panel title="Goal Tracker">
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <ProgressBar value={yearlyGoal > 0 ? ytdRevenue / yearlyGoal : 0} />
                  </div>
                  <div className="text-[1.55rem] font-black text-[#fa6e18]">
                    {percentLabel(yearlyGoal > 0 ? ytdRevenue / yearlyGoal : 0)}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <StatBlock label="Revenue (YTD)" value={formatCompactCurrency(ytdRevenue, 1)} />
                  <StatBlock accent={true} label="Pacing" value={formatCompactCurrency(revenuePacing, 1)} />
                  <StatBlock label="Goal" value={formatCompactCurrency(yearlyGoal, 1)} />
                </div>
              </Panel>

              <Panel title="Company Jobs Gross Margin Goal Tracker" titleClassName="text-[1.05rem] md:text-[1.2rem]">
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatBlock label="Monthly Goal" value={formatCurrency(data.jobCostingSummary.goal)} />
                  <StatBlock label="MTD Gross Margin" value={formatCurrency(data.jobCostingSummary.mtd)} />
                  <StatBlock label="Remaining" value={formatCurrency(remainingGrossMargin)} />
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-4 text-[0.95rem] font-black text-[#111827]">
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

              <Panel title="Monthly Pace">
                <div className="space-y-4">
                  <div>
                  <div className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#111827]">
                      Company Revenue Monthly Pace
                    </div>
                    <div className="rounded-[0.8rem] bg-[#fa6e18] px-4 py-2.5 text-center text-[1.15rem] font-black text-white">
                      {formatCompactCurrency(data.revenueMonthlyPace.value, 2)}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#111827]">
                      Company Sales Monthly Pace
                    </div>
                    <div className="rounded-[0.8rem] bg-[#fa6e18] px-4 py-2.5 text-center text-[1.15rem] font-black text-white">
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
