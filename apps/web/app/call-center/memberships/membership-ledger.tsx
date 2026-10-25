"use client";

import { useState } from "react";
import type { MembershipLedger, MembershipPerformance } from "@irbis/domain";
import { MembershipHint } from "./membership-hint";

const money = (value: number | null) =>
  value == null
    ? "—"
    : value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function MembershipAccounting({
  ledger,
  audit,
}: {
  ledger: MembershipLedger | null | undefined;
  audit: MembershipPerformance["salesAudit"];
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState(0);
  if (!ledger)
    return (
      <section className="csr-panel membership-accounting">
        <h2>Billing & payments</h2>
        <p className="membership-muted">
          Invoice reconciliation is being prepared. Refresh to load billing,
          applied payments and outstanding balances.
        </p>
      </section>
    );
  const scope = ledger.invoices.filter(
    (row) => kind === "all" || row.kind === kind,
  );
  const rows = scope.filter((row) =>
    [row.customer, row.number, row.jobNumber, row.membershipId]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 25)),
    currentPage = Math.min(page, pages - 1);
  const sum = (
    field:
      | "billed"
      | "subscription"
      | "jobRevenue"
      | "applied"
      | "paidInPeriod"
      | "otherCredits",
  ) =>
    scope.reduce((n, row) => n + Math.round(Number(row[field]) * 100), 0) / 100;
  const totals =
    kind === "all"
      ? ledger.totals
      : {
          billed: sum("billed"),
          subscription: sum("subscription"),
          jobs: sum("jobRevenue"),
          applied: ledger.paymentsAvailable ? sum("applied") : null,
          paidInPeriod: ledger.paymentsAvailable ? sum("paidInPeriod") : null,
          otherCredits: ledger.paymentsAvailable ? sum("otherCredits") : null,
          outstanding:
            scope.reduce(
              (n, row) => n + Math.max(0, Math.round(row.balance * 100)),
              0,
            ) / 100,
          creditBalance:
            scope.reduce(
              (n, row) => n + Math.min(0, Math.round(row.balance * 100)),
              0,
            ) / 100,
        };
  return (
    <section className="csr-panel membership-accounting">
      <div className="membership-panel-heading">
        <h2>Billing & payments</h2>
        <div className="membership-accounting-actions">
          <select
            aria-label="Filter membership invoice type"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setPage(0);
            }}
          >
            <option value="all">All invoice types</option>
            <option value="subscription">Subscription invoices</option>
            <option value="job">Job invoices</option>
            <option value="mixed">Mixed job + membership</option>
          </select>
          <MembershipHint label="billing and payments">
            Actual invoices for subscription billing during the selected dates
            and completed member jobs. Payments are net amounts applied to these
            invoices, including refunds. Current balances and applications may
            change after the reporting period. Mixed invoices retain their full
            invoice-level payment; no split between job and membership cash is
            inferred.
          </MembershipHint>
        </div>
      </div>
      <p className="membership-accounting-intro">
        Subscription invoices and completed member jobs ·{" "}
        {scope.length.toLocaleString("en-US")} invoices shown
      </p>
      <div className="membership-accounting-totals">
        <div>
          <span>
            Invoiced{" "}
            <MembershipHint label="invoiced amounts">
              Invoice totals including tax and adjustments. Subscription and job
              amounts below exclude tax. This includes recurring subscription
              bills, unlike membership sales value, which measures sale and
              renewal item prices.
            </MembershipHint>
          </span>
          <strong>{money(totals.billed)}</strong>
          <small>
            {money(totals.subscription)} subscriptions · {money(totals.jobs)}{" "}
            jobs
          </small>
        </div>
        <div>
          <span>
            Payments applied{" "}
            <MembershipHint label="payments applied">
              Net active payment allocations to these invoices as of the latest
              refresh, including partial payments and refunds. Unapplied
              customer credits are excluded. This is invoice-level accounting,
              not a bank deposit total.
            </MembershipHint>
          </span>
          <strong>{money(totals.applied)}</strong>
          <small>{money(totals.paidInPeriod)} paid within selected dates</small>
        </div>
        <div>
          <span>
            Outstanding now{" "}
            <MembershipHint label="outstanding balances">
              Positive balances still due on these invoices. Credit balances are
              shown separately and never reduce another customer's outstanding
              balance.
            </MembershipHint>
          </span>
          <strong>{money(totals.outstanding)}</strong>
          <small>{money(Math.abs(totals.creditBalance))} credit balances</small>
        </div>
      </div>
      {!ledger.paymentsAvailable && (
        <p role="status" className="membership-accounting-warning">
          Payment records are unavailable. Billed amounts and invoice balances
          remain available; payments are shown as a dash.
        </p>
      )}
      {totals.otherCredits != null && Math.abs(totals.otherCredits) >= 0.01 && (
        <p className="membership-accounting-note">
          Other invoice credits or adjustments: {money(totals.otherCredits)}.
          These are separate from payment receipts.
        </p>
      )}
      <details className="membership-invoice-details">
        <summary>
          View invoice details <span>{ledger.invoices.length}</span>
        </summary>
        <div className="membership-invoice-filters">
          <label className="membership-invoice-search">
            Find an invoice
            <input
              aria-label="Search membership invoices"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Customer, invoice, job or membership ID"
            />
          </label>
        </div>
        <div
          className="membership-table-wrap"
          role="region"
          aria-label="Membership billing and payment records"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Customer / invoice</th>
                <th>Type / date</th>
                <th>Invoiced</th>
                <th>Payments applied</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .slice(currentPage * 25, (currentPage + 1) * 25)
                .map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.customer}</b>
                      <small>
                        Invoice {row.number}
                        {row.jobNumber ? ` · Job ${row.jobNumber}` : ""}
                      </small>
                      {row.membershipId && (
                        <small>Membership {row.membershipId}</small>
                      )}
                      {row.adjustmentToId && (
                        <small>Adjusts invoice ID {row.adjustmentToId}</small>
                      )}
                    </td>
                    <td>
                      <span className="membership-invoice-kind">
                        {row.kind === "mixed"
                          ? "Job + membership"
                          : row.kind === "job"
                            ? "Job"
                            : "Subscription"}
                      </span>
                      <small>{row.date}</small>
                    </td>
                    <td>
                      {money(row.billed)}
                      <small>
                        {row.kind === "mixed"
                          ? `${money(row.subscription)} membership`
                          : `${money(row.tax)} tax`}
                      </small>
                    </td>
                    <td>
                      {money(row.applied)}
                      {row.refunds != null && row.refunds > 0 && (
                        <small>{money(row.refunds)} refunded</small>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          row.balance > 0
                            ? "membership-balance-due"
                            : "membership-balance-paid"
                        }
                      >
                        {row.balance < 0
                          ? `${money(Math.abs(row.balance))} credit`
                          : money(row.balance)}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="membership-customer-message">No matching invoices.</p>
          )}
        </div>
        <div className="membership-invoice-pagination">
          <span>
            {rows.length.toLocaleString("en-US")} invoices · Page{" "}
            {currentPage + 1} of {pages}
          </span>
          <button
            type="button"
            className="csr-button"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="csr-button"
            disabled={currentPage + 1 >= pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      </details>
      {!!audit?.excluded.length && (
        <details className="membership-invoice-details">
          <summary>
            Excluded sale records <span>{audit.excluded.length}</span>
          </summary>
          <p className="membership-accounting-note">
            These records are excluded consistently from new sales, renewals,
            departments and representative totals.
          </p>
          <div className="membership-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Membership / invoice</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {audit.excluded.map((row, index) => (
                  <tr key={`${row.membershipId}-${index}`}>
                    <td>{row.customer}</td>
                    <td>
                      {row.membershipId}
                      <small>Invoice {row.invoice}</small>
                    </td>
                    <td>{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
