"use client";

import { MarketingTooltip } from "./marketing-tooltip";
import {
  companyTrendAxisLabel,
  companyTrendPercent,
  companyTrendScale,
  companyTrendTooltip,
  type CompanyTrendingData,
} from "../lib/company-trending";

export function CompanyTrendingChart({
  data,
  cutoff,
}: {
  data: CompanyTrendingData;
  cutoff: string;
}) {
  const { max, ticks } = companyTrendScale(data);
  return (
    <>
      <div className="company-board__legend flex flex-wrap">
        <span className="border border-[#dfe5ee] bg-[#f1f3f7] font-semibold text-[#8b5b3c]">
          {data.years.previous} Sales
        </span>
        <span className="border border-[#dfe5ee] bg-[#f1f3f7] font-semibold text-[#4a90e2]">
          {data.years.previous} Revenue
        </span>
        <span className="border border-[#d7efe8] bg-[#eefaf7] font-semibold text-[#ff6b35]">
          {data.years.current} Sales
        </span>
        <span className="border border-[#d7efe8] bg-[#eefaf7] font-semibold text-[#17b4b0]">
          {data.years.current} Revenue
        </span>
        <span className="border border-[#d7efe8] bg-[#eefaf7] font-semibold text-[#2c8c32]">
          {data.years.current} Monthly goal
        </span>
      </div>
      <div className="company-board__trend-frame border border-[#edf0f4] bg-[#f8fbff]">
        <div
          className="company-board__trend-shell grid"
          role="group"
          aria-label="Monthly sales, revenue and goals"
        >
          <div
            className="company-board__trend-axis relative"
            aria-hidden="true"
          >
            {ticks.map((tick, index) => (
              <div
                className="company-board__trend-axis-label absolute left-0 right-0 flex -translate-y-1/2 items-center font-bold text-slate-500"
                key={tick}
                data-tick={tick}
                style={{ top: `${(index / 4) * 100}%` }}
              >
                {companyTrendAxisLabel(tick)}
              </div>
            ))}
          </div>
          <div
            className="company-board__trend-chart relative min-h-0"
            data-chart-max={max}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              aria-hidden="true"
            >
              {ticks.map((tick, index) => (
                <div
                  className="absolute left-0 right-0 border-t border-[#dbe6f4]"
                  key={tick}
                  data-grid-tick={tick}
                  style={{ top: `${(index / 4) * 100}%` }}
                />
              ))}
            </div>
            <div className="company-board__trend-bars absolute inset-0 grid grid-cols-12">
              {data.months.map((month, index) => (
                <MarketingTooltip
                  as="div"
                  key={month.month}
                  role="button"
                  data-month={month.month}
                  aria-label={`${month.month}: show sales, revenue and goal`}
                  className="company-board__trend-bar-group relative flex h-full items-end justify-center"
                  popupClassName="company-trend-tooltip"
                  content={companyTrendTooltip(data, month, index, cutoff)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.currentTarget.click();
                    }
                  }}
                >
                  {month.goal > 0 ? (
                    <div
                      className="company-board__trend-goal absolute left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#42d14a]"
                      data-goal={month.goal}
                      aria-hidden="true"
                      style={{ bottom: companyTrendPercent(month.goal, max) }}
                    />
                  ) : null}
                  {[
                    {
                      key: "previous-sales",
                      value: month.previous.sales,
                      color: "bg-[#8b5b3c]",
                    },
                    {
                      key: "previous-revenue",
                      value: month.previous.revenue,
                      color: "bg-[#4a90e2]",
                    },
                    {
                      key: "current-sales",
                      value: month.current.sales,
                      color: "bg-[#ff6b35]",
                    },
                    {
                      key: "current-revenue",
                      value: month.current.revenue,
                      color: "bg-[#17b4b0]",
                    },
                  ].map((series) => (
                    <div
                      key={series.key}
                      aria-hidden="true"
                      data-series={series.key}
                      data-value={series.value}
                      className={`company-board__trend-bar rounded-t-full ${series.color}`}
                      style={{ height: companyTrendPercent(series.value, max) }}
                    />
                  ))}
                </MarketingTooltip>
              ))}
            </div>
          </div>
          <div
            className="company-board__trend-months grid grid-cols-12"
            aria-hidden="true"
          >
            {data.months.map((month) => (
              <div
                className="company-board__trend-month text-center font-black uppercase tracking-[0.16em] text-slate-500"
                key={month.month}
              >
                {month.short ?? month.month.slice(0, 3)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
