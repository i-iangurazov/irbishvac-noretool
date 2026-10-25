import { describe, expect, it } from "vitest";
import {
  buildMembershipLedger,
  validateMembershipSales,
} from "./membership-ledger";

const period = { from: "2026-09-01", to: "2026-09-30" };
const invoice = (overrides = {}) => ({
  id: 1,
  referenceNumber: "INV-1",
  invoiceDate: "2026-09-10T00:00:00Z",
  invoiceConfiguration: "JobInvoice",
  active: true,
  total: "220.00",
  subTotal: "200.00",
  salesTax: "20.00",
  balance: "30.00",
  customer: { id: 3, name: "Example Customer" },
  job: { number: "JOB-1" },
  items: [
    { membershipTypeId: 42, skuName: "Annual", quantity: "1", total: "50.00" },
    { membershipTypeId: 0, total: "150.00" },
  ],
  ...overrides,
});
const build = (
  invoices: Record<string, unknown>[],
  payments: Record<string, unknown>[] | null = [],
) =>
  buildMembershipLedger({
    period,
    invoices,
    payments,
    jobRows: [{ InvoiceNumber: "INV-1" }],
    salesRows: [],
  });
const payment = (id: number, amount: string, date: string, invoiceId = 1) => ({
  id,
  active: true,
  date,
  appliedTo: [{ appliedId: id, appliedTo: invoiceId, appliedAmount: amount }],
});

describe("Membership invoice reconciliation", () => {
  it("includes linked adjustment invoices within the period without pulling later credits into a closed month", () => {
    const adjustment = invoice({
      id: 2,
      referenceNumber: "ADJ-2",
      adjustmentToId: 1,
      total: "-15.00",
      subTotal: "-15.00",
      salesTax: "0",
      balance: "0",
      items: [{ membershipTypeId: 0, total: "-15.00" }],
    });
    const future = invoice({
      id: 3,
      referenceNumber: "ADJ-3",
      adjustmentToId: 1,
      invoiceDate: "2026-10-01",
      total: "-25.00",
      subTotal: "-25.00",
      salesTax: "0",
      balance: "0",
      items: [{ membershipTypeId: 0, total: "-25.00" }],
    });
    const ledger = build([invoice(), adjustment, future]);
    expect(ledger.invoices.map((row) => row.number).sort()).toEqual([
      "ADJ-2",
      "INV-1",
    ]);
    expect(ledger.totals).toMatchObject({
      billed: 205,
      jobs: 135,
      subscription: 50,
    });
  });
  it("separates revenue, tax, partial payments, refunds and historical payment dates", () => {
    const ledger = build(
      [invoice()],
      [
        payment(1, "100.00", "2026-08-30"),
        payment(2, "80.00", "2026-09-10"),
        payment(3, "-10.00", "2026-09-20"),
        payment(4, "20.00", "2026-10-01"),
      ],
    );
    expect(ledger.totals).toEqual({
      billed: 220,
      subscription: 50,
      jobs: 150,
      tax: 20,
      applied: 190,
      paidInPeriod: 70,
      refunds: 10,
      outstanding: 30,
      creditBalance: 0,
      otherCredits: 0,
    });
    expect(ledger.invoices[0]).toMatchObject({
      kind: "mixed",
      applied: 190,
      balance: 30,
    });
  });
  it("uses allocations rather than the full amount of a payment shared across invoices", () => {
    const row = {
      ...payment(1, "100.00", "2026-09-10"),
      total: "9999.00",
      appliedTo: [
        { appliedId: 1, appliedTo: 1, appliedAmount: "100.00" },
        { appliedId: 2, appliedTo: 999, appliedAmount: "9899.00" },
      ],
    };
    expect(build([invoice()], [row]).totals.applied).toBe(100);
  });
  it("keeps unavailable payments unknown and ignores inactive invoices and voided payments", () => {
    expect(build([invoice()], null).totals).toMatchObject({
      applied: null,
      paidInPeriod: null,
      otherCredits: null,
      outstanding: 30,
    });
    expect(build([invoice({ active: false })]).invoices).toHaveLength(0);
    expect(
      build(
        [invoice()],
        [{ ...payment(1, "220.00", "2026-09-10"), active: false }],
      ).totals.applied,
    ).toBe(0);
  });
  it("includes recurring subscription invoices and keeps credit balances separate from amounts due", () => {
    const rows = [
      invoice(),
      invoice({
        id: 2,
        referenceNumber: "SUB-2",
        invoiceConfiguration: "MembershipInvoice",
        total: "-24.95",
        subTotal: "-24.95",
        salesTax: "0",
        balance: "-24.95",
        membershipId: 7,
        items: [],
      }),
    ];
    expect(build(rows).totals).toMatchObject({
      outstanding: 30,
      creditBalance: -24.95,
      subscription: 25.05,
    });
  });
  it("rejects duplicate accounting records and missing nonzero line evidence", () => {
    expect(() => build([invoice(), invoice()])).toThrow("Duplicate invoice");
    expect(() => build([invoice({ items: null })])).toThrow("line items");
    const row = payment(1, "100", "2026-09-10");
    expect(() => build([invoice()], [row, row])).toThrow("Duplicate payment");
  });
});

describe("Membership sale evidence", () => {
  it("excludes removed tasks and deleted records without removing free sales or later cancellations", () => {
    const sale = {
      CustomerName: "Example",
      CustomerMembershipId: 7,
      SaleRenewalInvoiceNumber: "INV-1",
      SaleRenewalItemCode: "Annual",
      MembershipStatus: "Canceled",
      MembershipPrice: 0,
    };
    expect(validateMembershipSales([sale], [invoice()]).accepted).toEqual([
      sale,
    ]);
    expect(
      validateMembershipSales([sale], [invoice({ items: [] })]).excluded[0]
        ?.reason,
    ).toMatch(/task removed/);
    expect(
      validateMembershipSales(
        [{ ...sale, MembershipStatus: "Deleted" }],
        [invoice()],
      ).accepted,
    ).toHaveLength(0);
    expect(() => validateMembershipSales([sale], [])).toThrow(
      "evidence missing",
    );
  });
});
