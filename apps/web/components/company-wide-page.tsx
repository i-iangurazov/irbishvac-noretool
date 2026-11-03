import type { ReactNode } from "react";
import {
  CapacityBars,
  DashboardShell,
  DataFreshnessBadge,
  EmptyDashboardState,
  FilterBar,
} from "@irbis/ui";
import { formatCompactCurrency, formatCurrency } from "@irbis/utils";
import { navItems } from "../lib/api";
import {
  buildDashboardQueryString,
  buildKioskHref,
  buildPresetHref,
  buildTvModeHref,
  type ResolvedDashboardFilters,
} from "../lib/dashboard-filters";
import { getBrandLogoUrl } from "../lib/assets";
import { CompanyWideGoalInsertButton } from "./company-wide-goal-insert-button";
import { companyFreshness } from "../lib/company-freshness";
import { CompanyTrendingChart } from "./company-trending-chart";
import type { CompanyTrendingData } from "../lib/company-trending";

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
  salesToday: {
    totals: { totalSales: number; totalRevenue: number };
    snapshotTime?: string | null;
  };
  salesYesterday: {
    totals: { totalSales: number; totalRevenue: number };
    snapshotTime?: string | null;
  };
  salesMonthlyPace: {
    pace: number;
    totalSalesToDate: number;
    snapshotTime?: string | null;
  };
  revenueMonthlyPace: {
    value: number;
    completedRevenueToDate: number;
    snapshotTime?: string | null;
  };
  bookingRate: {
    kpis: { leads: number; booked: number; unbooked: number; rate: number };
    snapshotTime?: string | null;
  };
  trending: CompanyTrendingData;
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

const MARKETING_COLORS = [
  "#18b3ad",
  "#4c56d7",
  "#ff8a1f",
  "#de4a89",
  "#7b79ff",
];

function Panel(props: {
  title?: string;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <section
      className={`company-panel border border-[#dfe5ee] bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] shadow-[0_6px_18px_rgba(15,23,42,0.05)] ${props.className ?? ""}`}
    >
      {props.title ? (
        <div
          className={`company-panel__title font-black uppercase tracking-tight text-[#111827] ${props.titleClassName ?? ""}`}
        >
          {props.title}
        </div>
      ) : null}
      <div
        className={`company-panel__body ${props.title ? "mt-4" : ""}`.trim()}
      >
        {props.children}
      </div>
    </section>
  );
}

function ProgressBar(props: { value: number; colorClassName?: string }) {
  return (
    <div className="company-progress-bar overflow-hidden rounded-full bg-[#e8edf3]">
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
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

function StatBlock(props: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="company-stat-block">
      <div className="company-stat-block__label font-bold uppercase tracking-[0.18em] text-slate-500">
        {props.label}
      </div>
      <div
        className={`company-stat-block__value font-black ${
          props.accent ? "text-[#fa6e18]" : "text-[#1f2937]"
        }`}
      >
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
  const trendingCurrentRevenue = data.trending.months.reduce(
    (sum, month) => sum + month.current.revenue,
    0,
  );
  const ytdRevenue =
    data.revenueGoals.yearTotalRevenue ||
    trendingCurrentRevenue ||
    data.revenueMonthlyPace.completedRevenueToDate;
  const businessYearStart = new Date(
    `${filters.to.slice(0, 4)}-01-01T00:00:00.000Z`,
  );
  const businessToDate = new Date(`${filters.to}T00:00:00.000Z`);
  const businessYear = Number(filters.to.slice(0, 4));
  const daysInYear =
    businessYear % 4 === 0 &&
    (businessYear % 100 !== 0 || businessYear % 400 === 0)
      ? 366
      : 365;
  const daysElapsed = Math.max(
    1,
    Math.floor(
      (businessToDate.getTime() - businessYearStart.getTime()) / 86_400_000,
    ) + 1,
  );
  const revenuePacing = daysElapsed > 0 ? ytdRevenue * (daysInYear / daysElapsed) : 0;
  const {freshness,hasCachedData} = companyFreshness([data.trending, data.marketing, data.capacity,
    data.jobCostingSummary, data.revenueGoals, data.salesToday, data.salesYesterday,
    data.salesMonthlyPace, data.revenueMonthlyPace, data.bookingRate]);
  const marketingTotal = data.marketing.rows.reduce(
    (sum, row) => sum + row.value,
    0,
  );
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
      color:
        MARKETING_COLORS[index % MARKETING_COLORS.length] ??
        MARKETING_COLORS[0] ??
        "#18b3ad",
    };
  });
  const marketingGradient = marketingRows.length
    ? marketingRows
        .map(
          (row) =>
            `${row.color} ${row.start.toFixed(2)}% ${row.end.toFixed(2)}%`,
        )
        .join(", ")
    : "#e8edf3 0% 100%";
  const topMarketingRow = marketingRows[0] ?? null;
  const bookingPct = Math.max(0, Math.min(data.bookingRate.kpis.rate, 1));
  const grossMarginScaleMax = Math.max(
    700_000,
    data.jobCostingSummary.goal,
    Math.abs(data.jobCostingSummary.mtd),
  );
  const grossMarginScalePct = Math.max(
    0,
    Math.min(
      (Math.max(data.jobCostingSummary.mtd, 0) / grossMarginScaleMax) * 100,
      100,
    ),
  );
  const grossMarginGoalMarkerPct = Math.max(
    0,
    Math.min(
      data.jobCostingSummary.goal > 0
        ? (data.jobCostingSummary.goal / grossMarginScaleMax) * 100
        : 0,
      100,
    ),
  );
  const remainingGrossMargin = data.jobCostingSummary.remainingToGoal;
  const grossMarginRemainingLabel =
    remainingGrossMargin < 0 ? "Ahead of Goal" : "Remaining";
  const grossMarginRemainingValue = formatCurrency(
    Math.abs(remainingGrossMargin),
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
      }}
      contentClassName={
        "company-wide-page__main"
      }
      headerContent={
        <div className="dashboard-header-tools flex flex-wrap items-center justify-end">
          <FilterBar
            from={filters.fromLabel}
            to={filters.toLabel}
            presets={[
              {
                label: "YTD",
                href: buildPresetHref("/company-wide", "ytd", filters),
                active: filters.preset === "ytd",
              },
              {
                label: "MTD",
                href: buildPresetHref("/company-wide", "mtd", filters),
                active: filters.preset === "mtd",
              },
            ]}
          />
          <DataFreshnessBadge value={freshness} />
        </div>
      }
    >
      <div className="company-wide-page flex h-full min-h-0 flex-col">
        {hasCachedData ? (
          <div className="company-board grid h-full min-h-0 items-start">
            <div className="company-board__left grid">
              <section className="company-board__trending-section">
                <div className="company-board__trending-header flex items-center justify-between">
                  <div
                    className="company-board__section-title company-board__trending-title font-black uppercase leading-none tracking-tight text-[#111827]"
                  >
                    Trending
                  </div>
                  <CompanyWideGoalInsertButton
                    goals={data.goals}
                    year={data.trending.years.current}
                  />
                </div>
                <Panel className="company-board__trending-panel">
                  <CompanyTrendingChart data={data.trending} cutoff={filters.to} />
                </Panel>
              </section>

              <div className="company-board__lower grid items-stretch">
                <Panel
                  className="company-board__marketing h-full"
                  title="Marketing"
                >
                  {marketingRows.length > 0 ? (
                    <div
                      className="company-board__marketing-grid grid h-full min-h-0"
                    >
                      <div className="company-board__marketing-summary-column flex flex-col justify-center">
                        <div className="mx-auto">
                          <div
                            className="company-board__marketing-ring relative rounded-full"
                            style={{
                              background: `conic-gradient(${marketingGradient})`,
                            }}
                          >
                            <div className="company-board__marketing-ring-inner absolute rounded-full bg-white" />
                          </div>
                        </div>

                        <div className="company-board__marketing-summary grid">
                          <div
                            className="company-board__marketing-metric bg-[#f8fbfd]"
                          >
                            <div
                              className="company-board__marketing-metric-label font-bold uppercase tracking-[0.18em] text-slate-500"
                            >
                              Total Attributed
                            </div>
                            <div
                              className="company-board__marketing-metric-value font-black text-[#1f2937]"
                            >
                              {formatCompactCurrency(marketingTotal, 1)}
                            </div>
                          </div>
                          <div
                            className="company-board__marketing-metric bg-[#f8fbfd]"
                          >
                            <div
                              className="company-board__marketing-metric-label font-bold uppercase tracking-[0.18em] text-slate-500"
                            >
                              Top Source
                            </div>
                            <div
                              className="company-board__marketing-metric-value font-black text-[#00363e]"
                            >
                              {topMarketingRow?.name ?? "N/A"}
                            </div>
                            <div
                              className="company-board__marketing-metric-subvalue font-bold text-[#18b3ad]"
                            >
                              {topMarketingRow
                                ? `${Math.round(topMarketingRow.share * 100)}% share`
                                : ""}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="company-board__marketing-rows grid content-start">
                        {marketingRows.slice(0, 5).map((row) => (
                          <div
                            className="company-board__marketing-row grid grid-cols-[minmax(0,1fr)_auto] items-center bg-[#fcfcfd]"
                            key={row.label}
                          >
                            <div className="company-board__marketing-row-main flex min-w-0 items-center">
                              <span
                                className="company-board__marketing-dot inline-flex rounded-full"
                                style={{ backgroundColor: row.color }}
                              />
                              <div className="min-w-0">
                                <div
                                  className="company-board__marketing-row-name font-semibold text-[#00363e]"
                                >
                                  {row.name}
                                </div>
                                <div
                                  className="company-board__marketing-row-detail font-medium text-slate-500"
                                >
                                  {Math.round(row.share * 100)}% of attributed
                                  revenue
                                </div>
                              </div>
                            </div>
                            <div
                              className="company-board__marketing-row-value text-right font-black text-[#1f2937]"
                            >
                              {formatCompactCurrency(row.value, 1)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="company-board__marketing-empty flex items-center justify-center text-slate-500">
                      No marketing rows available.
                    </div>
                  )}
                </Panel>

                <div
                  className="company-board__support grid h-full min-h-0"
                >
                  <Panel className="company-board__calls h-full" title="Calls">
                    <div className="company-board__calls-grid grid h-full min-h-0 items-start grid-cols-[auto_minmax(0,1fr)]">
                      <div
                        className="company-board__calls-ring relative flex items-center justify-center rounded-full"
                        style={{
                          background: `conic-gradient(#0b8b4f ${bookingPct * 360}deg, #d7fbef 0deg)`,
                        }}
                      >
                        <div className="company-board__calls-ring-inner absolute rounded-full bg-white shadow-inner" />
                        <div className="absolute text-center">
                          <div className="company-board__calls-rate font-black tracking-tight text-[#111827]">
                            {percentLabel(data.bookingRate.kpis.rate)}
                          </div>
                        </div>
                      </div>

                      <div className="company-board__calls-stats grid">
                        <div className="company-board__calls-stat-grid grid grid-cols-3 text-center">
                          <div className="company-board__calls-stat bg-[#f8fbfd]">
                            <div className="company-board__calls-stat-label uppercase tracking-[0.12em] text-slate-500">
                              Leads
                            </div>
                            <div className="company-board__calls-stat-value font-black text-[#1f2937]">
                              {data.bookingRate.kpis.leads}
                            </div>
                          </div>
                          <div className="company-board__calls-stat bg-[#f8fbfd]">
                            <div className="company-board__calls-stat-label uppercase tracking-[0.12em] text-slate-500">
                              Booked
                            </div>
                            <div className="company-board__calls-stat-value font-black text-[#1f2937]">
                              {data.bookingRate.kpis.booked}
                            </div>
                          </div>
                          <div className="company-board__calls-stat bg-[#f8fbfd]">
                            <div className="company-board__calls-stat-label uppercase tracking-[0.12em] text-slate-500">
                              Open
                            </div>
                            <div className="company-board__calls-stat-value font-black text-[#1f2937]">
                              {data.bookingRate.kpis.unbooked}
                            </div>
                          </div>
                        </div>
                        <div className="company-board__calls-note text-slate-500">
                          Based on the latest booking snapshot for the selected
                          date scope.
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

            <div className="company-board__right-rail grid">
              <Panel className="company-board__sales-panel" title="Sales">
                <div className="company-board__sales-grid grid">
                  <div className="company-board__period-card bg-[#f8fbfd]">
                    <div className="company-board__period-title text-center font-black uppercase tracking-[0.18em] text-slate-500">
                      Today
                    </div>
                    <div className="company-board__period-stats grid">
                      <StatBlock
                        label="Total Sales"
                        value={formatCurrency(
                          data.salesToday.totals.totalSales,
                        )}
                      />
                      <StatBlock
                        accent={true}
                        label="Total Revenue"
                        value={formatCurrency(
                          data.salesToday.totals.totalRevenue,
                        )}
                      />
                    </div>
                  </div>

                  <div className="company-board__period-card bg-[#f8fbfd]">
                    <div className="company-board__period-title text-center font-black uppercase tracking-[0.18em] text-slate-500">
                      Yesterday
                    </div>
                    <div className="company-board__period-stats grid">
                      <StatBlock
                        label="Total Sales"
                        value={formatCurrency(
                          data.salesYesterday.totals.totalSales,
                        )}
                      />
                      <StatBlock
                        accent={true}
                        label="Total Revenue"
                        value={formatCurrency(
                          data.salesYesterday.totals.totalRevenue,
                        )}
                      />
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel className="company-board__goal-panel" title="Goal Tracker">
                <div className="company-board__goal-progress flex items-center">
                  <div className="min-w-0 flex-1">
                    <ProgressBar
                      value={yearlyGoal > 0 ? ytdRevenue / yearlyGoal : 0}
                    />
                  </div>
                  <div className="company-board__goal-percent font-black text-[#fa6e18]">
                    {percentLabel(yearlyGoal > 0 ? ytdRevenue / yearlyGoal : 0)}
                  </div>
                </div>

                <div className="company-board__goal-stats grid">
                  <StatBlock
                    label="Revenue (YTD)"
                    value={formatCompactCurrency(ytdRevenue, 1)}
                  />
                  <StatBlock
                    accent={true}
                    label="Pacing"
                    value={formatCompactCurrency(revenuePacing, 1)}
                  />
                  <StatBlock
                    label="Goal"
                    value={formatCompactCurrency(yearlyGoal, 1)}
                  />
                </div>
              </Panel>

              <Panel
                className="company-board__gross-panel"
                title="Company Jobs Gross Margin Goal Tracker"
                titleClassName="company-board__gross-title"
              >
                <div className="company-board__gross-stats grid">
                  <StatBlock
                    label="Monthly Goal"
                    value={formatCurrency(data.jobCostingSummary.goal)}
                  />
                  <StatBlock
                    label="MTD Gross Margin"
                    value={formatCurrency(data.jobCostingSummary.mtd)}
                  />
                  <StatBlock
                    label={grossMarginRemainingLabel}
                    value={grossMarginRemainingValue}
                  />
                </div>

                <div className="company-board__gross-summary">
                  <div className="company-board__gross-summary-line flex items-center justify-between font-black text-[#111827]">
                    <span>MTD</span>
                    <span>
                      {formatCurrency(data.jobCostingSummary.mtd)}{" "}
                      <span className="company-board__gross-percent text-slate-500">
                        {percentLabel(data.jobCostingSummary.percentToGoal)}
                      </span>
                    </span>
                  </div>

                  <div className="company-board__gross-scale relative overflow-hidden rounded-full bg-[#eef2f6]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[#2683a3]"
                      style={{ width: `${grossMarginScalePct}%` }}
                    />
                    <div
                      className="company-board__gross-goal-marker absolute top-1/2 -translate-y-1/2 bg-[#7c8288]"
                      style={{ left: `${grossMarginGoalMarkerPct}%` }}
                    />
                  </div>

                  <div className="company-board__gross-scale-labels flex items-center justify-between font-bold text-slate-500">
                    <span>0</span>
                    <span>{axisCurrency(data.jobCostingSummary.goal)}</span>
                    <span>{axisCurrency(grossMarginScaleMax)}</span>
                  </div>
                </div>
              </Panel>

              <Panel className="company-board__pace-panel" title="Monthly Pace">
                <div className="company-board__pace-stack">
                  <div className="company-pace-card">
                    <div className="company-pace-card__label font-black uppercase tracking-[0.12em] text-[#111827]">
                      Company Revenue Monthly Pace
                    </div>
                    <div className="company-pace-card__value bg-[#fa6e18] text-center font-black text-white">
                      {formatCurrency(data.revenueMonthlyPace.value)}
                    </div>
                  </div>

                  <div className="company-pace-card">
                    <div className="company-pace-card__label font-black uppercase tracking-[0.12em] text-[#111827]">
                      Company Sales Monthly Pace
                    </div>
                    <div className="company-pace-card__value bg-[#fa6e18] text-center font-black text-white">
                      {formatCurrency(data.salesMonthlyPace.pace)}
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
