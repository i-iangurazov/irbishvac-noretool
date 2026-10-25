import type { MembershipPeriod } from "./membership-performance";

type Row = Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const cents = (v: unknown) => {
  if (v == null || v === "" || !Number.isFinite(Number(v)))
    throw new Error("Accounting amount missing");
  return Math.round(Number(v) * 100);
};
const inside = (v: unknown, p: MembershipPeriod) =>
  typeof v === "string" && v.slice(0, 10) >= p.from && v.slice(0, 10) <= p.to;

export type MembershipInvoice = {
  id: string;
  number: string;
  customer: string;
  customerId: string;
  membershipId: string | null;
  jobNumber: string | null;
  date: string;
  kind: "subscription" | "job" | "mixed";
  billed: number;
  subscription: number;
  jobRevenue: number;
  tax: number;
  applied: number | null;
  paidInPeriod: number | null;
  refunds: number | null;
  balance: number;
  otherCredits: number | null;
  adjustmentToId: string | null;
};
export type MembershipLedger = {
  invoices: MembershipInvoice[];
  paymentsAvailable: boolean;
  totals: {
    billed: number;
    subscription: number;
    jobs: number;
    applied: number | null;
    paidInPeriod: number | null;
    refunds: number | null;
    outstanding: number;
    creditBalance: number;
    tax: number;
    otherCredits: number | null;
  };
};

/** Invoice-level cash attribution: mixed invoices stay mixed; no invented split of payments. */
export function buildMembershipLedger(input: {
  period: MembershipPeriod;
  invoices: Row[];
  payments: Row[] | null;
  jobRows: Row[];
  salesRows: Row[];
}): MembershipLedger {
  const jobs = new Set(input.jobRows.map((r) => String(r.InvoiceNumber)));
  const saleCodes = new Map<string, Set<string>>();
  for (const row of input.salesRows) {
    const number = text(row.SaleRenewalInvoiceNumber),
      code = text(row.SaleRenewalItemCode);
    if (row.MembershipStatus === "Deleted") continue;
    if (number && code)
      saleCodes.set(number, new Set([...(saleCodes.get(number) ?? []), code]));
  }
  const ids = new Set<string>();
  const byId = new Map(
    input.invoices.map((invoice) => [String(invoice.id), invoice]),
  );
  const selected = new Set(
    input.invoices
      .filter(
        (invoice) =>
          invoice.active === true &&
          (jobs.has(text(invoice.referenceNumber)) ||
            (inside(invoice.invoiceDate, input.period) &&
              (invoice.invoiceConfiguration === "MembershipInvoice" ||
                saleCodes.has(text(invoice.referenceNumber))))),
      )
      .map((invoice) => String(invoice.id)),
  );
  // Include dated adjustment invoices of the selected invoice cohort, once each.
  for (let changed = true; changed; ) {
    changed = false;
    for (const invoice of input.invoices) {
      const id = String(invoice.id);
      if (
        !selected.has(id) &&
        invoice.active === true &&
        inside(invoice.invoiceDate, input.period) &&
        invoice.adjustmentToId != null &&
        selected.has(String(invoice.adjustmentToId))
      ) {
        selected.add(id);
        changed = true;
      }
    }
  }
  const invoices: MembershipInvoice[] = [];
  for (const invoice of input.invoices) {
    if (invoice.active !== true) continue;
    const id = String(invoice.id),
      number = text(invoice.referenceNumber);
    if (ids.has(id)) throw new Error("Duplicate invoice");
    ids.add(id);
    const membershipInvoice =
      invoice.invoiceConfiguration === "MembershipInvoice";
    if (!selected.has(id)) continue;
    const total = cents(invoice.total),
      subTotal = cents(invoice.subTotal),
      tax = cents(invoice.salesTax);
    let subscription = membershipInvoice ? subTotal : 0;
    if (!membershipInvoice) {
      const items = invoice.items as Row[] | null;
      if (!Array.isArray(items) && total !== 0)
        throw new Error("Invoice line items unavailable");
      subscription = (items ?? []).reduce(
        (sum, item) =>
          sum +
          (Number(item.membershipTypeId) > 0 ||
          saleCodes.get(number)?.has(text(item.skuName))
            ? cents(item.total)
            : 0),
        0,
      );
    }
    const applied = input.payments ? { total: 0, period: 0, refunds: 0 } : null;
    const applications = new Set<string>();
    for (const payment of input.payments ?? []) {
      if (payment.active !== true) continue;
      if (!Array.isArray(payment.appliedTo))
        throw new Error("Payment allocations unavailable");
      for (const allocation of payment.appliedTo as Row[]) {
        if (String(allocation.appliedTo) !== id) continue;
        const key = `${payment.id}:${allocation.appliedId}`;
        if (applications.has(key))
          throw new Error("Duplicate payment allocation");
        applications.add(key);
        const amount = cents(allocation.appliedAmount);
        applied!.total += amount;
        if (inside(payment.date, input.period)) applied!.period += amount;
        if (amount < 0) applied!.refunds += -amount;
      }
    }
    const balance = cents(invoice.balance);
    invoices.push({
      id,
      number,
      customer: text((invoice.customer as Row)?.name),
      customerId: String((invoice.customer as Row)?.id ?? ""),
      membershipId:
        invoice.membershipId == null ? null : String(invoice.membershipId),
      jobNumber:
        text((invoice.job as Row)?.number) ||
        text((byId.get(String(invoice.adjustmentToId))?.job as Row)?.number) ||
        null,
      date: text(invoice.invoiceDate).slice(0, 10),
      kind: membershipInvoice ? "subscription" : subscription ? "mixed" : "job",
      billed: total / 100,
      subscription: subscription / 100,
      jobRevenue: (subTotal - subscription) / 100,
      tax: tax / 100,
      applied: applied ? applied.total / 100 : null,
      paidInPeriod: applied ? applied.period / 100 : null,
      refunds: applied ? applied.refunds / 100 : null,
      balance: balance / 100,
      otherCredits: applied ? (total - balance - applied.total) / 100 : null,
      adjustmentToId:
        invoice.adjustmentToId == null ? null : String(invoice.adjustmentToId),
    });
  }
  invoices.sort(
    (a, b) => b.date.localeCompare(a.date) || a.number.localeCompare(b.number),
  );
  const sum = (field: keyof MembershipInvoice) =>
    invoices.reduce((n, r) => n + Math.round(Number(r[field]) * 100), 0) / 100;
  return {
    invoices,
    paymentsAvailable: input.payments !== null,
    totals: {
      billed: sum("billed"),
      subscription: sum("subscription"),
      jobs: sum("jobRevenue"),
      tax: sum("tax"),
      applied: input.payments ? sum("applied") : null,
      paidInPeriod: input.payments ? sum("paidInPeriod") : null,
      refunds: input.payments ? sum("refunds") : null,
      otherCredits: input.payments ? sum("otherCredits") : null,
      outstanding:
        invoices.reduce(
          (n, r) => n + Math.max(0, Math.round(r.balance * 100)),
          0,
        ) / 100,
      creditBalance:
        invoices.reduce(
          (n, r) => n + Math.min(0, Math.round(r.balance * 100)),
          0,
        ) / 100,
    },
  };
}

/** Validate against the actual active invoice task, including free memberships. */
export function validateMembershipSales(sales: Row[], invoices: Row[]) {
  const byNumber = new Map(invoices.map((r) => [text(r.referenceNumber), r]));
  const accepted: Row[] = [],
    excluded: Array<{
      customer: string;
      membershipId: string;
      invoice: string;
      reason: string;
    }> = [];
  for (const row of sales) {
    const number = text(row.SaleRenewalInvoiceNumber),
      code = text(row.SaleRenewalItemCode);
    if (row.MembershipStatus === "Deleted") {
      excluded.push({
        customer: text(row.CustomerName),
        membershipId: String(row.CustomerMembershipId ?? ""),
        invoice: number,
        reason: "Membership deleted",
      });
      continue;
    }
    const invoice = byNumber.get(number);
    if (!invoice || !number || !code)
      throw new Error("Sale invoice evidence missing");
    const items = invoice.items as Row[] | null;
    const present =
      invoice.active === true &&
      Array.isArray(items) &&
      items.some(
        (item) => text(item.skuName) === code && Number(item.quantity) > 0,
      );
    if (present && row.MembershipStatus !== "Deleted") accepted.push(row);
    else
      excluded.push({
        customer: text(row.CustomerName),
        membershipId: String(row.CustomerMembershipId ?? ""),
        invoice: number,
        reason:
          invoice.active !== true
            ? "Invoice removed"
            : row.MembershipStatus === "Deleted"
              ? "Membership deleted"
              : "Membership task removed from invoice",
      });
  }
  return { accepted, excluded };
}
