import { describe, expect, it } from "vitest";
import { membershipReportRows } from "./membership-performance";
describe("membership report completeness", () => {
  it("accepts a complete empty report while rejecting missing metric columns", () => {
    expect(
      membershipReportRows(
        {
          fields: [{ name: "SoldOn" }],
          data: [],
          hasMore: false,
          totalCount: 0,
        },
        ["SoldOn"],
      ),
    ).toEqual([]);
    expect(() =>
      membershipReportRows({ fields: [{ name: "Name" }], data: [] }, [
        "SoldOn",
      ]),
    ).toThrow();
  });
  it("rejects partial reports even when the page says it is final", () => {
    expect(() =>
      membershipReportRows(
        {
          fields: [{ name: "SoldOn" }],
          data: [["2026-09-01"]],
          hasMore: false,
          totalCount: 2,
        },
        ["SoldOn"],
      ),
    ).toThrow();
    expect(() =>
      membershipReportRows(
        { fields: [{ name: "SoldOn" }], data: [], hasMore: true },
        ["SoldOn"],
      ),
    ).toThrow();
  });
});
