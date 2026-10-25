import { describe, expect, it } from "vitest";
import {
  membershipReportRows,
  membershipSalesEvidence,
} from "./membership-performance";
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

it("matches deleted and current sales to distinct invoice evidence and consumes duplicates once", () => {
  const common = {
    CustomerName: "Example",
    SoldBy: "Seller",
    SoldOn: "2026-09-01",
    ActivationMethod: "New Sale",
    MembershipPrice: 0,
    From: "2026-09-01",
    To: "2027-08-31",
  };
  const base = [
    {
      ...common,
      MembershipStatus: "Deleted",
      SaleRenewalInvoiceNumber: "removed",
    },
    {
      ...common,
      MembershipStatus: "Active",
      SaleRenewalInvoiceNumber: "valid-1",
    },
    {
      ...common,
      MembershipStatus: "Active",
      SaleRenewalInvoiceNumber: "valid-2",
    },
  ];
  const details = [
    { ...common, MembershipStatus: "Active", CustomerMembershipId: 1 },
    { ...common, MembershipStatus: "Deleted", CustomerMembershipId: 2 },
    { ...common, MembershipStatus: "Active", CustomerMembershipId: 3 },
  ];
  const result = membershipSalesEvidence(base, details);
  expect(result.matching).toBe(true);
  expect(result.rows?.map((r) => r.SaleRenewalInvoiceNumber)).toEqual([
    "valid-1",
    "removed",
    "valid-2",
  ]);
  expect(membershipSalesEvidence(base, details.slice(1))).toEqual({
    matching: false,
    rows: base,
  });
});
