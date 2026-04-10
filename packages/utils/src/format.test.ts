import { describe, expect, it } from "vitest";
import { formatCurrency, formatNumber, formatPercent } from "./format";

describe("format helpers", () => {
  it("formats currency without stray decimals", () => {
    expect(formatCurrency(19425)).toBe("$19,425");
  });

  it("formats currency with english grouping and cents when requested", () => {
    expect(
      formatCurrency(22589.21, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
    ).toBe("$22,589.21");
  });

  it("formats plain numbers with grouping and optional decimals", () => {
    expect(formatNumber(3)).toBe("3");
    expect(
      formatNumber(17653.26, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
    ).toBe("17,653.26");
  });

  it("formats ratio values as percents", () => {
    expect(formatPercent(0.741)).toBe("74.1%");
  });
});
