"use client";

import { MarketingIcon, type MarketingIconName } from "./marketing-icon";
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
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@irbis/utils/src/format";
import type { CampaignPerformanceData } from "./campaign-performance-page";
import {
  bookingRateFor,
  channelRoas,
  performanceSeries,
  rowCategory,
  spendCoverage,
  topChannels,
  totalCommissionCost,
  type ChannelSort,
  type PerformanceMetric,
} from "../lib/campaign-overview";

const percent = (value: number | null | undefined) =>
  value == null ? "—" : formatPercent(value, 1);
const money = (value: number | null | undefined) =>
  value == null ? "—" : formatCurrency(value);
const multiple = (value: number | null | undefined) =>
  value == null ? "—" : `${value.toFixed(1)}×`;
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
const metricLabels: Record<PerformanceMetric, string> = {
  qualifiedLeads: "Qualified Leads",
  bookedJobs: "Booked Jobs",
  completedRevenue: "Completed Revenue",
  soldAmount: "Sales Value",
};

export function MarketingOverview({
  data,
  history,
}: {
  data: CampaignPerformanceData;
  history: CampaignPerformanceData[];
}) {
  const [metric, setMetric] = useState<PerformanceMetric>("completedRevenue");
  const [sort, setSort] = useState<ChannelSort>("completedRevenue");
  const coverage = spendCoverage(data);
  const complete = coverage.status === "complete";
  const roas = complete ? data.actual.roas : coverage.coveredRoas;
  const cpl = complete ? data.actual.costPerLead : coverage.coveredCostPerLead;
  const cpb = complete
    ? data.actual.costPerBookedJob
    : coverage.coveredCostPerBookedJob;
  const leadsAvailable = data.leadDataStatus !== "unavailable";
  const paid = data.rows.filter((row) => rowCategory(row) === "paid");
  const organic = data.rows.filter((row) => rowCategory(row) === "organic");
  const budget = data.plan.marketingBudgetGoal;
  const spendRatio = budget > 0 ? data.actual.spend / budget : null;
  const budgetApproved = data.plan.approvalStatus === "approved";
  const departments = (data.revenueByDepartment ?? [])
    .filter((row) => row.completedRevenue !== 0)
    .sort((a, b) => b.completedRevenue - a.completedRevenue);
  const departmentTotal = departments.reduce(
    (sum, row) => sum + Math.max(0, row.completedRevenue),
    0,
  );
  const departmentColors = [
    "#2c5440",
    "#799b82",
    "#b4c7a9",
    "#efa47c",
    "#f6ccaa",
    "#acbcc0",
    "#71878f",
  ];
  const departmentRow = (row: (typeof departments)[number], index: number) => (
    <div className="marketing-department" key={row.department}>
      <span>
        <i
          style={{
            background: departmentColors[index % departmentColors.length],
          }}
        />
        {row.department}
      </span>
      <b>{formatCompactCurrency(row.completedRevenue)}</b>
    </div>
  );
  const series = performanceSeries(
    history.filter((period) => period.period.from <= data.period.from),
    metric,
  );
  const currencyMetric =
    metric === "completedRevenue" || metric === "soldAmount";
  const rows = [
    ...topChannels(data.rows, "paid", sort),
    ...topChannels(data.rows, "organic", sort),
  ];

  return (
    <div className="marketing-overview">
      <section
        className="marketing-card marketing-revenue"
        aria-labelledby="completed-revenue-title"
      >
        <div className="marketing-card-heading">
          <h3 id="completed-revenue-title">Completed Revenue</h3>
          <span className="marketing-period-tag">MTD</span>
        </div>
        <strong className="marketing-revenue-total">
          {money(data.actual.completedRevenue)}
        </strong>
        <div className="marketing-roas">
          <b>{multiple(roas)}</b>{" "}
          {complete ? "ROAS" : "ROAS · covered channels"}
        </div>
        <div className="marketing-departments">
          <h4>Revenue by department</h4>
          {departments.length ? (
            <>
              <div
                className="marketing-department-distribution"
                role="img"
                aria-label="Revenue distribution by department"
              >
                {departments
                  .filter((row) => row.completedRevenue > 0)
                  .map((row, index) => (
                    <span
                      key={row.department}
                      title={`${row.department}: ${money(row.completedRevenue)}`}
                      style={{
                        width: `${(row.completedRevenue / departmentTotal) * 100}%`,
                        background:
                          departmentColors[index % departmentColors.length],
                      }}
                    />
                  ))}
              </div>
              {departments.slice(0, 3).map(departmentRow)}
              {departments.length > 3 ? (
                <div className="marketing-department-details">
                  <button
                    aria-haspopup="dialog"
                    className="marketing-department-toggle"
                    popoverTarget="marketing-department-popover"
                    type="button"
                  >
                    View all {departments.length} entries
                    <MarketingIcon name="chevron" size={15} />
                  </button>
                  <div
                    aria-labelledby="marketing-department-popover-title"
                    className="marketing-department-popover"
                    id="marketing-department-popover"
                    popover="auto"
                    role="dialog"
                  >
                    <div className="marketing-department-popover-heading">
                      <h4 id="marketing-department-popover-title">
                        Revenue by department
                      </h4>
                      <button
                        aria-label="Close department breakdown"
                        autoFocus
                        popoverTarget="marketing-department-popover"
                        popoverTargetAction="hide"
                        type="button"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                    {departments.map(departmentRow)}
                    <small>
                      Department reporting differences are shown separately as
                      reconciliation.
                    </small>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="marketing-empty">
              Department breakdown will appear after the next data refresh.
            </p>
          )}
        </div>
      </section>

      <section
        className="marketing-kpis"
        aria-label="Sales and lead performance"
      >
        {[
          {
            label: "Sold Estimates",
            value: formatNumber(data.actual.soldJobs),
            note: "Sold this month",
            icon: "receipt",
          },
          {
            label: "Sales Value",
            value: formatCompactCurrency(data.actual.soldAmount),
            note: "Value of sold estimates",
            icon: "sales",
          },
          {
            label: "Qualified Leads",
            value: leadsAvailable
              ? formatNumber(data.actual.qualifiedLeads)
              : "—",
            note: leadsAvailable
              ? "Good + mid-quality leads"
              : "Lead data unavailable",
            icon: "users",
          },
          {
            label: "Booked Jobs",
            value: leadsAvailable ? formatNumber(data.actual.bookedJobs) : "—",
            note: leadsAvailable
              ? "Booked this month"
              : "Booking data unavailable",
            icon: "booked",
          },
        ].map((item) => (
          <div className="marketing-kpi" key={item.label}>
            <div>
              <h3>{item.label}</h3>
              <span className="marketing-kpi-icon">
                <MarketingIcon name={item.icon as MarketingIconName} />
              </span>
            </div>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </div>
        ))}
      </section>

      <section
        className="marketing-card marketing-booking"
        aria-labelledby="booking-rate-title"
      >
        <div className="marketing-card-heading">
          <h3 id="booking-rate-title">Booking Rate</h3>
          <span className="marketing-heading-icon">
            <MarketingIcon name="activity" />
          </span>
        </div>
        <span className="marketing-muted">Total Booking Rate</span>
        <strong className="marketing-booking-total">
          {leadsAvailable ? percent(data.actual.bookingRate) : "—"}
        </strong>
        <p>
          {leadsAvailable
            ? `${formatNumber(data.actual.bookedJobs)} booked / ${formatNumber(data.actual.qualifiedLeads)} qualified leads`
            : "Connect this month’s call-center report to see bookings."}
        </p>
        <div className="marketing-booking-meter" aria-hidden="true">
          <span
            style={{
              width: `${Math.max(0, Math.min(1, leadsAvailable ? (data.actual.bookingRate ?? 0) : 0)) * 100}%`,
            }}
          />
        </div>
        <div className="marketing-booking-split">
          {[
            { label: "Paid", rows: paid },
            { label: "Organic", rows: organic },
          ].map((group) => (
            <div key={group.label}>
              <span>
                <i
                  className={`marketing-dot marketing-dot--${group.label.toLowerCase()}`}
                />
                {group.label}
              </span>
              <strong>
                {leadsAvailable ? percent(bookingRateFor(group.rows)) : "—"}
              </strong>
            </div>
          ))}
        </div>
        <small className="marketing-booking-note">
          Total includes all acquisition channels.
        </small>
      </section>

      <aside className="marketing-costs" aria-label="Marketing costs">
        <section className="marketing-card marketing-spend">
          <div className="marketing-card-heading">
            <h3>Marketing Spend</h3>
            <span className="marketing-period-tag">MTD</span>
          </div>
          <strong className="marketing-spend-total">
            {money(data.actual.spend)}
          </strong>
          <p>
            {budgetApproved ? "Monthly limit" : "Model monthly limit"}{" "}
            <b>{budget > 0 ? money(budget) : "Not set"}</b>
          </p>
          <div
            className={`marketing-budget-track${(spendRatio ?? 0) > 1 ? " is-over" : ""}`}
            role="progressbar"
            aria-label="Monthly marketing budget used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              spendRatio == null
                ? undefined
                : Math.round(Math.min(1, Math.max(0, spendRatio)) * 100)
            }
            aria-valuetext={
              spendRatio == null
                ? "No limit set"
                : `${percent(spendRatio)} of monthly limit`
            }
          >
            <i
              style={{
                width: `${Math.min(1, Math.max(0, spendRatio ?? 0)) * 100}%`,
              }}
            />
          </div>
          <div className="marketing-budget-caption">
            <span>{percent(spendRatio)} used</span>
            <span>
              {budget > 0
                ? `${money(Math.abs(budget - data.actual.spend))} ${data.actual.spend > budget ? "over limit" : "remaining"}`
                : ""}
            </span>
          </div>
          <small>
            {money(totalCommissionCost(data))} commissions tracked separately.
          </small>
          {!complete ? (
            <p className="marketing-coverage">
              Spend coverage: {coverage.trackedPaidChannels}/
              {coverage.activePaidChannels} active paid channels.
            </p>
          ) : null}
        </section>
        <section
          className="marketing-card marketing-cost-metrics"
          aria-label="Acquisition costs"
        >
          <h3>Acquisition Costs</h3>
          <div>
            <span>Cost per lead</span>
            <strong>{leadsAvailable ? money(cpl) : "—"}</strong>
          </div>
          <div>
            <span>Cost per booked appointment</span>
            <strong>{leadsAvailable ? money(cpb) : "—"}</strong>
          </div>
          <small>
            Media spend + commissions
            {complete ? "." : " · covered paid channels only."}
          </small>
        </section>
      </aside>

      <section
        className="marketing-card marketing-performance-graph"
        aria-labelledby="performance-graph-title"
      >
        <div className="marketing-card-heading">
          <div>
            <h3 id="performance-graph-title">Performance Graph</h3>
            <p>Monthly performance · Paid vs Organic</p>
          </div>
          <select
            aria-label="Performance metric"
            value={metric}
            onChange={(event) =>
              setMetric(event.target.value as PerformanceMetric)
            }
          >
            {Object.entries(metricLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="marketing-chart-legend">
          <span>
            <i className="marketing-dot marketing-dot--paid" />
            Paid
          </span>
          <span>
            <i className="marketing-dot marketing-dot--organic" />
            Organic
          </span>
        </div>
        <div
          className="marketing-chart"
          role="img"
          aria-label={`${metricLabels[metric]} by month, split into paid and organic channels`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={series}
              barCategoryGap="28%"
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              accessibilityLayer
            >
              <CartesianGrid
                strokeDasharray="3 4"
                vertical={false}
                stroke="#e9ece8"
              />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6c7470", fontSize: 14 }}
              />
              <YAxis
                width={64}
                tickFormatter={(value: number) =>
                  currencyMetric
                    ? formatCompactCurrency(value, value >= 1_000_000 ? 1 : 0)
                    : formatNumber(value)
                }
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6c7470", fontSize: 13 }}
              />
              <Tooltip
                cursor={{ fill: "#f3f6f1" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e4e9e2",
                  boxShadow: "0 8px 24px #263e2810",
                  fontSize: 14,
                }}
                formatter={(value: number, name: string) => [
                  currencyMetric ? money(value) : formatNumber(value),
                  name,
                ]}
                labelFormatter={(_label, payload) => {
                  const point = payload[0]?.payload;
                  return point
                    ? `${monthLabel(point.month)} · through ${point.cutoff}${point.snapshot ? " · snapshot" : ""}`
                    : "";
                }}
              />
              <Bar
                dataKey="paid"
                name="Paid"
                fill="#eb9b71"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
                isAnimationActive={false}
              />
              <Bar
                dataKey="organic"
                name="Organic"
                fill="#345e48"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="marketing-chart-note">
          Each month uses its available cutoff. Other acquisition groups are
          excluded.
        </p>
        <div className="sr-only">
          <table>
            <caption>{metricLabels[metric]} monthly data</caption>
            <thead>
              <tr>
                <th>Month / through</th>
                <th>Paid</th>
                <th>Organic</th>
              </tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.month}>
                  <th>
                    {point.month} / {point.cutoff}
                    {point.snapshot ? " (snapshot)" : ""}
                  </th>
                  <td>{point.paid ?? "Unavailable"}</td>
                  <td>{point.organic ?? "Unavailable"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="marketing-card marketing-top-channels"
        aria-labelledby="top-channels-title"
      >
        <div className="marketing-card-heading">
          <div>
            <h3 id="top-channels-title">Top performing channels</h3>
            <p>Top 3 paid + top 3 organic</p>
          </div>
          <label className="marketing-sort">
            <span>Sort by</span>
            <select
              aria-label="Sort top channels"
              value={sort}
              onChange={(event) => setSort(event.target.value as ChannelSort)}
            >
              <option value="completedRevenue">Revenue</option>
              <option value="soldAmount">Sales</option>
              <option value="roas">ROAS</option>
            </select>
          </label>
        </div>
        <div className="marketing-table-wrap">
          <table className="marketing-channel-table">
            <thead>
              <tr>
                <th scope="col">Channel</th>
                <th scope="col">Type</th>
                <th scope="col">Revenue</th>
                <th scope="col">Sales</th>
                <th scope="col">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.channel}>
                  <th scope="row">
                    <span className="marketing-channel-rank">
                      {String((index % 3) + 1).padStart(2, "0")}
                    </span>
                    <span className="marketing-channel-icon" aria-hidden="true">
                      {row.channel.slice(0, 1)}
                    </span>
                    {row.channel}
                  </th>
                  <td>
                    <span
                      className={`marketing-channel-type marketing-channel-type--${rowCategory(row)}`}
                    >
                      {rowCategory(row) === "paid" ? "Paid" : "Organic"}
                    </span>
                  </td>
                  <td>{money(row.actual.completedRevenue)}</td>
                  <td>{money(row.actual.soldAmount)}</td>
                  <td>{multiple(channelRoas(row))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length ? (
          <p className="marketing-empty">No channel data for this period.</p>
        ) : null}
        <small>
          ROAS uses media spend + commissions. A dash means cost data is
          unavailable or no cost is recorded.
        </small>
      </section>
    </div>
  );
}
