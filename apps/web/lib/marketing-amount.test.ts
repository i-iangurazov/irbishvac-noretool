import { describe, it, expect } from "vitest";
import { exactCurrency, advertisingReturnDetail } from "./marketing-amount";
describe("precise financial hover details", () => {
  it("shows full dollar amounts and cents instead of K abbreviations", () => {
    expect(exactCurrency(32430.9)).toBe("$32,430.90");
    expect(exactCurrency(6772.5)).toBe("$6,772.50");
    expect(exactCurrency(0)).toBe("$0.00");
  });
  it("explains the exact numerator, denominator, missing cohort and media-only basis", () => {
    const text = advertisingReturnDetail({
      income: 460691.36,
      spend: 62191.137469,
      returnOnSpend: 460691.36 / 62191.137469,
      missing: ["Website"],
    });
    expect(text).toContain("$460,691.36 ÷ $62,191.14 = 7.4077×");
    expect(text).toContain("Commissions are separate");
    expect(text).toContain("Website");
    expect(
      advertisingReturnDetail({
        income: 0,
        spend: 0,
        returnOnSpend: null,
        missing: [],
      }),
    ).toContain("unavailable");
  });
});
