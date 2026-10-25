"use client";

import { useState } from "react";
import type { CampaignPerformanceData } from "./campaign-performance-page";
import { formatCompactCurrency as money, formatPercent } from "@irbis/utils/src/format";
import { rowCommissionCost } from "../lib/campaign-overview";
import {
  advertisingReturns,
  filterRevenueRows,
  revenueGroup,
  revenueLabels,
  sortRevenueRows,
  type RevenueFilter,
  type RevenueMetric,
} from "../lib/campaign-revenue";

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
    <div className="revenue-toggle" role="group" aria-label={label}>
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
function Filter({
  value,
  onChange,
  label,
}: {
  value: RevenueFilter;
  onChange: (value: RevenueFilter) => void;
  label: string;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RevenueFilter)}
      >
        <option value="all">All channels</option>
        <option value="paid">Paid</option>
        <option value="organic">Organic</option>
      </select>
    </label>
  );
}
function Distribution({
  items,
  label,
}: {
  items: Array<{ name: string; value: number }>;
  label: string;
}) {
  const positive = items.filter((item) => item.value > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  const colors = [
    "#2563eb",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#0891b2",
  ];
  return (
    <div className="revenue-distribution">
      {total > 0 ? (
        <svg viewBox="0 0 120 120" role="img" aria-label={label}>
          {positive.map((item) => {
            const share = (item.value / total) * 100;
            const start = offset;
            offset += share;
            return (
              <circle
                key={item.name}
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke={colors[items.indexOf(item) % colors.length]}
                strokeWidth="18"
                pathLength="100"
                strokeDasharray={`${share} ${100 - share}`}
                strokeDashoffset={-start}
                transform="rotate(-90 60 60)"
              >
                <title>
                  {item.name}: {money(item.value)} (
                  {formatPercent(item.value / total)})
                </title>
              </circle>
            );
          })}
        </svg>
      ) : (
        <p>No positive values to chart.</p>
      )}
      <ul>
        {items.map((item, index) => (
          <li key={item.name}>
            <i
              style={{ background: colors[index % colors.length] }}
              aria-hidden="true"
            />
            <span>{item.name}</span>
            <strong>{money(item.value)}</strong>
            <small>
              {total > 0 && item.value >= 0
                ? formatPercent(item.value / total)
                : "—"}
            </small>
          </li>
        ))}
      </ul>
      {items.some((item) => item.value < 0) ? (
        <p>
          Negative adjustments are listed but excluded from the circle; shares
          use positive values.
        </p>
      ) : null}
    </div>
  );
}
export function RevenueView({ data }: { data: CampaignPerformanceData }) {
  const [metric, setMetric] = useState<RevenueMetric>("completedRevenue");
  const [grouping, setGrouping] = useState("channel");
  const [filter, setFilter] = useState<RevenueFilter>("all");
  const [chartFilter, setChartFilter] = useState<RevenueFilter>("all");
  const [chartMetric, setChartMetric] =
    useState<RevenueMetric>("completedRevenue");
  const [sort, setSort] = useState("value");
  const label = metric === "completedRevenue" ? "Revenue" : "Sales";
  const returnLabel = metric === "completedRevenue" ? "ROAS" : "SOAS";
  const ratioLabel = `Expense to ${metric === "completedRevenue" ? "Income" : "Sales"} Ratio`;
  const returns = advertisingReturns(data.rows, metric);
  const total = data.actual[metric];
  const sum = (rows: typeof data.rows) =>
    rows.reduce((sum, row) => sum + row.actual[metric], 0);
  const groups = (["paid", "organic", "other", "separate-spend"] as const).map(
    (group) => ({
      name: revenueLabels[group],
      value: sum(data.rows.filter((row) => revenueGroup(row) === group)),
    }),
  );
  const rows = sortRevenueRows(
    filterRevenueRows(data.rows, filter),
    metric,
    sort,
  );
  const departments =
    metric === "completedRevenue"
      ? data.revenueByDepartment?.map((row) => ({
          name: row.department,
          value: row.completedRevenue,
        }))
      : data.salesByDepartment?.map((row) => ({
          name: row.department,
          value: row.soldAmount,
        }));
  const channelItems = data.rows.map((row) => ({
    name: row.channel,
    value: row.actual[metric],
  }));
  const difference = total - sum(data.rows);
  if (Math.abs(difference) > 0.01)
    channelItems.push({ name: "Reporting reconciliation", value: difference });
  const displayReturn = (value: number | null) =>
    value == null ? "—" : `${value.toFixed(2)}x`;
  return (
    <div className="revenue-view">
      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading">
          <div>
            <h3>
              {metric === "completedRevenue"
                ? "Total Completed Revenue"
                : "Total Sales"}
            </h3>
            <strong className="revenue-total">{money(total)}</strong>
            <p>
              Revenue is completed ServiceTitan revenue. Sales is sold estimate
              value, not collected cash. Through {data.period.to}.
            </p>
          </div>
          <MetricToggle
            value={metric}
            onChange={setMetric}
            label="Summary metric"
          />
        </div>
        <div className="campaign-table-panel__heading">
          <h3>{label} distribution</h3>
          <label>
            Group by
            <select
              value={grouping}
              onChange={(e) => setGrouping(e.target.value)}
            >
              <option value="channel">Channel</option>
              <option value="department">Business units</option>
            </select>
          </label>
        </div>
        {grouping === "department" && !departments?.length ? (
          <p role="status">
            {label} by business unit is unavailable in this report. Channel
            totals remain available.
          </p>
        ) : (
          <Distribution
            items={grouping === "department" ? departments! : channelItems}
            label={`${label} distribution by ${grouping === "department" ? "business unit" : "channel"}`}
          />
        )}
      </section>
      <section
        className="marketing-summary-cards"
        aria-label={`${label} groups`}
      >
        {groups.map((group) => (
          <article className="marketing-summary-card" key={group.name}>
            <h3>{group.name}</h3>
            <div className="marketing-summary-card-value">
              <strong>{money(group.value)}</strong>
            </div>
            <p>
              {total > 0 ? formatPercent(group.value / total) : "—"} of total{" "}
              {label.toLowerCase()}
            </p>
          </article>
        ))}
      </section>
      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading">
          <div>
            <h3>Marketing Spend · {returnLabel}</h3>
            <p>
              {returnLabel} = attributed paid {label.toLowerCase()} ÷ paid media
              spend. {ratioLabel} = paid media spend ÷ the same attributed
              value. Commissions are shown separately.
            </p>
          </div>
          <strong>
            {displayReturn(returns.returnOnSpend)} ·{" "}
            {returns.expenseRatio == null
              ? "—"
              : formatPercent(returns.expenseRatio)}
          </strong>
        </div>
        <div className="revenue-spend">
          {(["paid", "separate-spend"] as const).map((group) => {
            const grouped = data.rows.filter(
              (row) => revenueGroup(row) === group,
            );
            return (
              <div key={group}>
                <h4>
                  {group === "paid" ? "Performance Marketing" : "Branding/ATL"}
                </h4>
                <strong>
                  {money(
                    grouped.reduce((sum, row) => sum + row.actual.spend, 0),
                  )}
                </strong>
                <p>
                  {group === "paid" ? "Paid channels" : "Billboards, TV, Radio"}{" "}
                  ·{" "}
                  {money(
                    grouped.reduce(
                      (sum, row) => sum + rowCommissionCost(row),
                      0,
                    ),
                  )}{" "}
                  commissions separately
                </p>
              </div>
            );
          })}
        </div>
        <p role="status">
          {returns.missing.length
            ? `Partial coverage: excludes ${returns.missing.join(", ")} from both sides of the ratios.`
            : "Ratios use paid channels with recorded media spend."}{" "}
          Covered {label.toLowerCase()}: {money(returns.income)}; media spend:{" "}
          {money(returns.spend)}. Branding/ATL is excluded from attributed paid
          returns.
        </p>
      </section>
      <section className="campaign-table-panel">
        <div className="campaign-table-panel__heading">
          <div>
            <h3>Performance by Channels</h3>
            <p>
              Table follows the summary Revenue/Sales selection. All includes
              Branding/ATL and Unmapped.
            </p>
          </div>
        </div>
        <div className="revenue-columns">
          <div className="revenue-column">
            <div className="revenue-controls">
              <Filter
                value={filter}
                onChange={setFilter}
                label="Table channels"
              />
              <label>
                Sort by
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="value">{label} · highest first</option>
                  <option value="return">{returnLabel} · highest first</option>
                  <option value="ratio">{ratioLabel} · lowest first</option>
                </select>
              </label>
            </div>
            <div className="campaign-table-wrap">
              <table className="campaign-table">
                <thead>
                  <tr>
                    <th>Channel / Type</th>
                    <th>{label}</th>
                    <th>Media / Commission</th>
                    <th>{returnLabel}</th>
                    <th>{ratioLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const result = advertisingReturns([row], metric);
                    return (
                      <tr key={row.channel}>
                        <td>
                          <strong>{row.channel}</strong>
                          <span>{revenueLabels[revenueGroup(row)]}</span>
                        </td>
                        <td>{money(row.actual[metric])}</td>
                        <td>
                          {result.missing.length
                            ? "Missing"
                            : money(row.actual.spend)}
                          <span>
                            {money(rowCommissionCost(row))} commission
                          </span>
                        </td>
                        <td>{displayReturn(result.returnOnSpend)}</td>
                        <td>
                          {result.expenseRatio == null
                            ? "—"
                            : formatPercent(result.expenseRatio)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!rows.length ? <p>No matching channels.</p> : null}
            </div>
          </div>
          <div className="revenue-column">
            <div className="revenue-controls">
              <MetricToggle
                value={chartMetric}
                onChange={setChartMetric}
                label="Channel chart metric"
              />
              <Filter
                value={chartFilter}
                onChange={setChartFilter}
                label="Chart channels"
              />
            </div>
            <Distribution
              items={filterRevenueRows(data.rows, chartFilter)
                .map((row) => ({
                  name: row.channel,
                  value: row.actual[chartMetric],
                }))
                .sort((a, b) => b.value - a.value)}
              label={`${chartMetric === "completedRevenue" ? "Revenue" : "Sales"} by channel`}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
