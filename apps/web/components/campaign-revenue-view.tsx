"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatCompactCurrency as compact,
  formatCurrency as money,
  formatNumber,
  formatPercent,
} from "@irbis/utils/src/format";
import { MarketingIcon, type MarketingIconName } from "./marketing-icon";
import type { CampaignPerformanceData } from "./campaign-performance-page";
import {
  advertisingReturns,
  filterRevenueRows,
  marketingExpenses,
  revenueDistribution,
  revenueGroup,
  revenueLabels,
  sortRevenueRows,
  type DistributionItem,
  type RevenueFilter,
  type RevenueMetric,
  type RevenueSort,
} from "../lib/campaign-revenue";

const colors = [
  "#315b44",
  "#88a48d",
  "#b7c9ad",
  "#eb9b71",
  "#f2c9aa",
  "#9bafb5",
  "#71878f",
];
const rate = (value: number | null) =>
  value == null ? "—" : formatPercent(value, 1);
const multiple = (value: number | null) =>
  value == null ? "—" : `${value.toFixed(1)}×`;
function MetricToggle({
  value,
  onChange,
  label,
}: {
  value: RevenueMetric;
  onChange: (value: RevenueMetric) => void;
  label: string;
}) {
  return (
    <div className="revenue-segments" role="group" aria-label={label}>
      {(["completedRevenue", "soldAmount"] as const).map((metric) => (
        <button
          type="button"
          key={metric}
          aria-pressed={value === metric}
          onClick={() => onChange(metric)}
        >
          {metric === "completedRevenue" ? "Revenue" : "Sales"}
        </button>
      ))}
    </div>
  );
}
function ChannelFilter({
  value,
  onChange,
  label,
}: {
  value: RevenueFilter;
  onChange: (value: RevenueFilter) => void;
  label: string;
}) {
  return (
    <label className="revenue-select">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as RevenueFilter)}
      >
        <option value="all">All channels</option>
        <option value="paid">Paid</option>
        <option value="organic">Organic</option>
      </select>
    </label>
  );
}
function Donut({
  items,
  total,
  label,
}: {
  items: DistributionItem[] | null;
  total: number;
  label: string;
}) {
  if (!items)
    return (
      <div className="revenue-empty">
        <MarketingIcon name="layers" size={28} />
        <strong>Business unit breakdown unavailable</strong>
        <p>
          This report does not include {label.toLowerCase()} by business unit.
        </p>
      </div>
    );
  const positive = items.filter((row) => row.value > 0),
    negative = items.filter((row) => row.value < 0);
  const shown =
    positive.length > 5
      ? [
          ...positive.slice(0, 5),
          {
            name: `Other (${positive.length - 5})`,
            value: positive.slice(5).reduce((sum, row) => sum + row.value, 0),
          },
        ]
      : positive;
  const positiveTotal = positive.reduce((sum, row) => sum + row.value, 0);
  let offset = 0;
  return (
    <>
      <div className="revenue-donut-layout">
        <div className="revenue-donut">
          <svg
            viewBox="0 0 160 160"
            role="img"
            aria-label={`${label} distribution`}
          >
            <circle
              cx="80"
              cy="80"
              r="65"
              fill="none"
              stroke="#eef2eb"
              strokeWidth="18"
            />
            {shown.map((row, index) => {
              const share = (row.value / positiveTotal) * 100,
                start = offset;
              offset += share;
              return (
                <circle
                  key={row.name}
                  cx="80"
                  cy="80"
                  r="65"
                  fill="none"
                  stroke={colors[index]}
                  strokeWidth="18"
                  pathLength="100"
                  strokeDasharray={`${share} ${100 - share}`}
                  strokeDashoffset={-start}
                  transform="rotate(-90 80 80)"
                >
                  <title>{`${row.name}: ${money(row.value)} · ${rate(row.value / positiveTotal)}`}</title>
                </circle>
              );
            })}
          </svg>
          <div className="revenue-donut-center">
            <span>{label}</span>
            <strong>{compact(total)}</strong>
          </div>
        </div>
        <div className="revenue-legend">
          {shown.map((row, index) => (
            <div key={row.name}>
              <i style={{ background: colors[index] }} />
              <span>{row.name}</span>
              <strong title={money(row.value)}>{compact(row.value)}</strong>
              <small>{rate(row.value / positiveTotal)}</small>
            </div>
          ))}
          {!positive.length ? (
            <p className="marketing-empty">
              No positive {label.toLowerCase()} in this period.
            </p>
          ) : null}
        </div>
      </div>
      {negative.length ? (
        <p className="revenue-note">
          Adjustments:{" "}
          {negative.map((row) => `${row.name} ${money(row.value)}`).join("; ")}.
          Circle shares use positive values.
        </p>
      ) : null}
      {positive.length > 5 || negative.length ? (
        <details className="revenue-details">
          <summary>View full breakdown ({items.length})</summary>
          <div>
            {items.map((row) => (
              <p key={row.name}>
                <span>{row.name}</span>
                <strong>{money(row.value)}</strong>
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}
export function RevenueView({ data }: { data: CampaignPerformanceData }) {
  const [metric, setMetric] = useState<RevenueMetric>("completedRevenue");
  const [grouping, setGrouping] = useState<"channel" | "department">("channel");
  const [efficiency, setEfficiency] = useState<"return" | "ratio">("return");
  const [tableFilter, setTableFilter] = useState<RevenueFilter>("all");
  const [chartFilter, setChartFilter] = useState<RevenueFilter>("all");
  const [chartMetric, setChartMetric] =
    useState<RevenueMetric>("completedRevenue");
  const [sort, setSort] = useState<RevenueSort>("value");
  const [chartExpanded, setChartExpanded] = useState(false);
  const label = metric === "completedRevenue" ? "Revenue" : "Sales",
    returnLabel = metric === "completedRevenue" ? "ROAS" : "SOAS";
  const expenseLabel = `Expense to ${metric === "completedRevenue" ? "Income" : "Sales"} Ratio`;
  const returns = advertisingReturns(data.rows, metric),
    spend = marketingExpenses(data, metric);
  const total = data.actual[metric];
  const groups = (["paid", "organic", "other"] as const).map((group) => ({
    group,
    value: data.rows
      .filter((row) => revenueGroup(row) === group)
      .reduce((sum, row) => sum + row.actual[metric], 0),
  }));
  const rows = sortRevenueRows(
    filterRevenueRows(data.rows, tableFilter),
    metric,
    sort,
  );
  const chartRows = sortRevenueRows(
    filterRevenueRows(data.rows, chartFilter),
    chartMetric,
    "value",
  )
    .filter((row) => row.actual[chartMetric] !== 0)
    .map((row) => ({ channel: row.channel, value: row.actual[chartMetric] }));
  const visibleChartRows = chartExpanded ? chartRows : chartRows.slice(0, 8);
  const chartLabel = chartMetric === "completedRevenue" ? "Revenue" : "Sales";
  const icons: Record<string, MarketingIconName> = {
    paid: "broadcast",
    organic: "users",
    other: "layers",
  };
  return (
    <div className="revenue-workspace">
      <div className="revenue-top-grid">
        <section
          className="marketing-card revenue-balance"
          aria-labelledby="revenue-total-title"
        >
          <div className="marketing-card-heading">
            <h3 id="revenue-total-title">
              {metric === "completedRevenue"
                ? "Total Completed Revenue"
                : "Total Sales"}
            </h3>
            <span className="marketing-period-tag">MTD</span>
          </div>
          <MetricToggle
            value={metric}
            onChange={setMetric}
            label="Summary metric"
          />
          <strong className="marketing-revenue-total" title={money(total)}>
            {money(total)}
          </strong>
          <p className="revenue-subtitle">
            {metric === "completedRevenue"
              ? "Completed work · recognized revenue"
              : "Sold estimates · sales value"}
          </p>
          <div className="revenue-balance-footer">
            <span>
              <MarketingIcon name="receipt" size={16} />
              {formatNumber(data.actual.soldJobs)} sold estimates
            </span>
            <span>Through {data.period.to}</span>
          </div>
        </section>
        <section
          className="marketing-card revenue-distribution-card"
          aria-labelledby="revenue-distribution-title"
        >
          <div className="marketing-card-heading">
            <div>
              <h3 id="revenue-distribution-title">{label} Distribution</h3>
              <p>
                Share of {label.toLowerCase()} ·{" "}
                {grouping === "channel" ? "by channel" : "by business unit"}
              </p>
            </div>
            <label className="revenue-select">
              <span className="sr-only">Group distribution by</span>
              <select
                aria-label="Group distribution by"
                value={grouping}
                onChange={(e) =>
                  setGrouping(e.target.value as "channel" | "department")
                }
              >
                <option value="channel">By channel</option>
                <option value="department">By business units</option>
              </select>
            </label>
          </div>
          <Donut
            items={revenueDistribution(data, metric, grouping)}
            total={total}
            label={label}
          />
        </section>
      </div>
      <div className="revenue-metrics-grid">
        {groups.map(({ group, value }) => (
          <section
            className={`marketing-card revenue-group-card revenue-group-card--${group}`}
            key={group}
          >
            <div className="marketing-card-heading">
              <h3>{revenueLabels[group]}</h3>
              <span className="revenue-card-icon">
                <MarketingIcon name={icons[group]!} />
              </span>
            </div>
            <strong title={money(value)}>{compact(value)}</strong>
            <p>
              {rate(total > 0 ? value / total : null)}{" "}
              <span>of total {label.toLowerCase()}</span>
            </p>
            <small>
              {group === "paid"
                ? "Attributed to paid channels"
                : group === "organic"
                  ? "Organic & automation"
                  : "Kept in totals for reconciliation"}
            </small>
          </section>
        ))}
        <section className="marketing-card revenue-efficiency">
          <div className="marketing-card-heading">
            <h3>Marketing Efficiency</h3>
            <MarketingIcon name="activity" />
          </div>
          <label className="revenue-select">
            <span className="sr-only">Efficiency metric</span>
            <select
              aria-label="Efficiency metric"
              value={efficiency}
              onChange={(e) =>
                setEfficiency(e.target.value as "return" | "ratio")
              }
            >
              <option value="return">{returnLabel}</option>
              <option value="ratio">{expenseLabel}</option>
            </select>
          </label>
          <strong>
            {efficiency === "return"
              ? multiple(returns.returnOnSpend)
              : rate(spend.ratio)}
          </strong>
          <p>
            {efficiency === "return"
              ? "Paid media · covered channels"
              : "Recorded marketing spend / total"}
          </p>
          <span
            className={`revenue-coverage${returns.missing.length ? " revenue-coverage--partial" : ""}`}
          >
            {returns.missing.length
              ? "Partial spend coverage"
              : "Recorded spend"}
          </span>
        </section>
      </div>
      <section
        className="marketing-card revenue-spend-card"
        aria-label="Marketing Spend"
      >
        <div className="revenue-spend-heading">
          <h3>Marketing Spend</h3>
          <strong>{money(spend.total)}</strong>
          <small>Recorded media spend · MTD</small>
        </div>
        <div className="revenue-spend-item">
          <i />
          <div>
            <span>Performance Marketing</span>
            <strong>{money(spend.paid)}</strong>
            <small>Paid channels</small>
          </div>
        </div>
        <div className="revenue-spend-item revenue-spend-item--brand">
          <i />
          <div>
            <span>Branding / ATL</span>
            <strong>{money(spend.branding)}</strong>
            <small>Billboards, TV & radio</small>
          </div>
        </div>
        {Math.abs(spend.other) > 0.01 ? (
          <div className="revenue-spend-item">
            <i />
            <div>
              <span>Other / reconciliation</span>
              <strong>{money(spend.other)}</strong>
              <small>Other recorded media spend</small>
            </div>
          </div>
        ) : null}
        <div className="revenue-spend-commission">
          <span>Commissions</span>
          <strong>{money(spend.commission)}</strong>
          <small>Shown separately from media spend</small>
        </div>
      </section>
      <section
        className="marketing-card revenue-performance"
        aria-labelledby="revenue-performance-title"
      >
        <div className="marketing-card-heading">
          <div>
            <h3 id="revenue-performance-title">Performance by Channels</h3>
            <p>Compare channel contributions and advertising returns</p>
          </div>
          <span className="marketing-period-tag">{label}</span>
        </div>
        <div className="revenue-performance-grid">
          <div className="revenue-table-panel">
            <div className="revenue-panel-controls">
              <h4>Channel Performance</h4>
              <div>
                <ChannelFilter
                  value={tableFilter}
                  onChange={setTableFilter}
                  label="Table channels"
                />
                <label className="revenue-select">
                  <span className="sr-only">Sort channels</span>
                  <select
                    aria-label="Sort channels"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as RevenueSort)}
                  >
                    <option value="value">{label} · highest first</option>
                    <option value="return">
                      {returnLabel} · highest first
                    </option>
                    <option value="ratio">Expense ratio · lowest first</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="revenue-table-scroll">
              <table className="marketing-channel-table revenue-channel-table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>{label}</th>
                    <th>Share</th>
                    <th>{returnLabel}</th>
                    <th>Expense ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const result = advertisingReturns([row], metric);
                    return (
                      <tr key={row.channel}>
                        <td>
                          <span className="revenue-channel-name">
                            <span className="marketing-channel-avatar">
                              {row.channel.slice(0, 1)}
                            </span>
                            <span>
                              <strong>{row.channel}</strong>
                              <small>{revenueLabels[revenueGroup(row)]}</small>
                            </span>
                          </span>
                        </td>
                        <td
                          data-label={label}
                          title={money(row.actual[metric])}
                        >
                          {compact(row.actual[metric])}
                        </td>
                        <td data-label="Share">
                          {rate(total > 0 ? row.actual[metric] / total : null)}
                        </td>
                        <td data-label={returnLabel}>
                          {multiple(result.returnOnSpend)}
                        </td>
                        <td data-label="Expense ratio">
                          {rate(result.expenseRatio)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!rows.length ? (
                <p className="marketing-empty">No matching channels.</p>
              ) : null}
            </div>
            <p className="revenue-note">
              Returns use recorded paid media spend. Unavailable ratios appear
              as —.
            </p>
          </div>
          <div className="revenue-chart-panel">
            <div className="revenue-panel-controls">
              <h4>{chartLabel} by Channel</h4>
              <div>
                <MetricToggle
                  value={chartMetric}
                  onChange={setChartMetric}
                  label="Channel chart metric"
                />
                <ChannelFilter
                  value={chartFilter}
                  onChange={setChartFilter}
                  label="Chart channels"
                />
              </div>
            </div>
            {chartRows.length ? (
              <>
                <div
                  className="revenue-bar-chart"
                  style={{
                    height: Math.max(230, visibleChartRows.length * 38),
                  }}
                  role="img"
                  aria-label={`${chartLabel} by channel, ${chartFilter}`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={visibleChartRows}
                      layout="vertical"
                      margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 5"
                        horizontal={false}
                        stroke="#e4e9e2"
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(value) => compact(Number(value))}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "#6e7c72" }}
                      />
                      <YAxis
                        type="category"
                        dataKey="channel"
                        width={115}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "#526353" }}
                      />
                      <Tooltip
                        formatter={(value) => money(Number(value))}
                        cursor={{ fill: "#f1f4ee" }}
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid #e2e8df",
                          fontSize: 12,
                        }}
                      />
                      <Bar
                        dataKey="value"
                        name={chartLabel}
                        fill="#315b44"
                        radius={[0, 5, 5, 0]}
                        barSize={16}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {chartRows.length > 8 ? (
                  <button
                    type="button"
                    className="revenue-show-channels"
                    aria-expanded={chartExpanded}
                    onClick={() => setChartExpanded(!chartExpanded)}
                  >
                    {chartExpanded
                      ? "Show top 8 channels"
                      : `Show all ${chartRows.length} channels`}
                  </button>
                ) : null}
                <details className="revenue-details">
                  <summary>View chart values</summary>
                  <div>
                    {chartRows.map((row) => (
                      <p key={row.channel}>
                        <span>{row.channel}</span>
                        <strong>{money(row.value)}</strong>
                      </p>
                    ))}
                  </div>
                </details>
              </>
            ) : (
              <p className="marketing-empty">
                No {chartLabel.toLowerCase()} for these channels.
              </p>
            )}
          </div>
        </div>
      </section>
      <details className="revenue-methodology">
        <summary>
          <MarketingIcon name="receipt" size={14} />
          Metric definitions & data coverage
        </summary>
        <div>
          <p>
            <strong>Revenue</strong> is completed ServiceTitan revenue.{" "}
            <strong>Sales</strong> is sold estimate value, not collected cash.
            Both use the displayed reporting cutoff.
          </p>
          <p>
            <strong>{returnLabel}</strong> = attributed paid{" "}
            {label.toLowerCase()} ÷ paid media spend. Commissions and
            Branding/ATL are excluded. Covered {label.toLowerCase()}:{" "}
            {money(returns.income)}; covered media spend: {money(returns.spend)}
            .
          </p>
          <p>
            <strong>{expenseLabel}</strong> in Marketing Efficiency = all
            recorded marketing media spend (including Branding/ATL) ÷ total{" "}
            {label.toLowerCase()}. Table ratios use each paid channel’s media
            spend and attributed value. No advertising return is assigned to
            organic or branding channels.
          </p>
          <p>
            {returns.missing.length
              ? `Missing paid spend: ${returns.missing.join(", ")}. Those channels are excluded from both sides of ROAS/SOAS. Total expense ratios reflect recorded spend only and may understate costs.`
              : "No active paid channels are missing recorded media spend."}{" "}
            Commissions: {money(spend.commission)}.
          </p>
        </div>
      </details>
    </div>
  );
}
