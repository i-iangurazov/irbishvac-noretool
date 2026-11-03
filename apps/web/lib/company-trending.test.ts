import { describe, expect, it } from "vitest";
import {
  companyTrendAxisLabel,
  companyTrendPercent,
  companyTrendScale,
  companyTrendTooltip,
  type CompanyTrendingData,
} from "./company-trending";

const month = {
  month: "November",
  previous: { sales: 1000.25, revenue: 900.1 },
  current: { sales: 25.22, revenue: 10.01 },
  goal: 2_000_000,
};
const data: CompanyTrendingData = {
  years: { previous: 2025, current: 2026 },
  months: [month],
  chartMax: 2_520_000,
};
describe("Company-wide chart amounts and scale", () => {
  it("uses readable equal ticks that cover every amount, including a newly inserted goal", () => {
    expect(companyTrendScale(data)).toEqual({
      max: 3_000_000,
      ticks: [3_000_000, 2_250_000, 1_500_000, 750_000, 0],
    });
    expect(
      companyTrendScale({ ...data, months: [{ ...month, goal: 4_000_000 }] })
        .max,
    ).toBeGreaterThanOrEqual(4_000_000);
    expect(companyTrendAxisLabel(2_250_000)).toBe("$2.25M");
  });
  it("does not inflate small actuals or create bars for zero", () => {
    expect(companyTrendPercent(0, 3_000_000)).toBe("0%");
    expect(parseFloat(companyTrendPercent(25.22, 3_000_000))).toBeCloseTo(
      (25.22 / 3_000_000) * 100,
      12,
    );
  });
  it("shows exact cents, the monthly goal and the partial-month cutoff", () => {
    const tooltip = companyTrendTooltip(data, month, 10, "2026-11-03");
    expect(tooltip).toContain("2025 Sales: $1,000.25");
    expect(tooltip).toContain("2026 Sales (through Nov 3): $25.22");
    expect(tooltip).toContain("2026 Monthly goal: $2,000,000.00");
    const future = companyTrendTooltip(
      data,
      { ...month, month: "December", current: { sales: 0, revenue: 0 } },
      11,
      "2026-11-03",
    );
    expect(future).toContain("2026 Sales: Not started");
    expect(future).not.toContain("2026 Sales: $0");
    expect(companyTrendTooltip(data, month, 10, "2026-11-30")).not.toContain(
      "through",
    );
  });
});
