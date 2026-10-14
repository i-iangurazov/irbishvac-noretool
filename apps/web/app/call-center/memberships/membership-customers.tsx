"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import type {
  MembershipCustomerMetric,
  MembershipCustomerPage,
  MembershipPeriod,
} from "@irbis/domain";

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value}T12:00:00Z`))
    : "—";

function CustomerDialog({
  metric,
  label,
  count,
  period,
  snapshotTime,
  close,
}: {
  metric: MembershipCustomerMetric;
  label: string;
  count: number;
  period: MembershipPeriod;
  snapshotTime: string;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId(),
    searchId = useId(),
    router = useRouter();
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const [data, setData] = useState<MembershipCustomerPage | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [changed, setChanged] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const element = dialog.current!;
    returnFocus.current ??= document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!element.open) element.showModal();
    return () => {
      document.body.style.overflow = overflow;
      returnFocus.current?.focus();
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setChanged(false);
    setData(null);
    const params = new URLSearchParams({
      ...period,
      snapshotTime,
      page: String(page),
      q: query,
    });
    fetch(
      `/api/dashboard/call-center/memberships/customers/${metric}?${params}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        if (response.status === 409) {
          setChanged(true);
          throw new Error(
            "The dashboard has updated. Refresh to view these customers.",
          );
        }
        if (!response.ok)
          throw new Error("Customer details could not be loaded.");
        return response.json() as Promise<MembershipCustomerPage>;
      })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Customer details could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [metric, period.from, period.to, snapshotTime, query, page, attempt]);
  const sale = metric === "newSales" || metric === "renewals";
  const dateLabel =
    metric === "activeMembers"
      ? "Member since"
      : sale
        ? "Sold on"
        : metric === "cancellations"
          ? "Canceled on"
          : "Expired on";
  const ready = data?.state === "ready";
  return (
    <dialog
      ref={dialog}
      className="membership-customer-dialog"
      aria-labelledby={titleId}
      onClose={close}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          dialog.current?.close();
        }
      }}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="membership-customer-content">
        <header className="membership-customer-heading">
          <div>
            <h2 id={titleId}>{label}</h2>
            <p>
              {count.toLocaleString("en-US")} memberships ·{" "}
              {metric === "activeMembers"
                ? `As of ${date(period.to)}`
                : `${date(period.from)} – ${date(period.to)}`}
            </p>
          </div>
          <button
            type="button"
            className="csr-button"
            aria-label="Close customer details"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        <label className="membership-customer-search" htmlFor={searchId}>
          <Search size={18} aria-hidden="true" />
          <span className="membership-visually-hidden">Search customers</span>
          <input
            id={searchId}
            type="search"
            placeholder="Search customers, plans or membership ID"
            maxLength={100}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="membership-customer-results" aria-busy={loading}>
          {loading ? (
            <p className="membership-customer-message" role="status">
              Loading customers…
            </p>
          ) : error ? (
            <div className="membership-customer-message" role="alert">
              <p>{error}</p>
              <button
                className="csr-button"
                onClick={() => {
                  if (changed) {
                    close();
                    router.refresh();
                  } else setAttempt((value) => value + 1);
                }}
              >
                {changed ? "Refresh dashboard" : "Try again"}
              </button>
            </div>
          ) : !ready ? (
            <div className="membership-customer-message" role="status">
              <p>
                {data?.state === "pending"
                  ? "Preparing customer details for this period."
                  : "Customer details are temporarily unavailable for this period."}
              </p>
              <button
                className="csr-button"
                onClick={() => {
                  close();
                  router.refresh();
                }}
              >
                Refresh dashboard
              </button>
            </div>
          ) : !data.rows.length ? (
            <p className="membership-customer-message" role="status">
              {query
                ? "No matching customers."
                : "No memberships in this period."}
            </p>
          ) : (
            <table className="membership-customer-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Membership</th>
                  <th>{dateLabel}</th>
                  {sale && <th>Sold by</th>}
                  <th>Term ends</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <strong>{row.customerName}</strong>
                      {row.customerId && (
                        <small>Customer #{row.customerId}</small>
                      )}
                    </td>
                    <td>
                      <span>{row.membershipType}</span>
                      <small>Membership #{row.membershipId}</small>
                    </td>
                    <td>
                      {date(
                        metric === "activeMembers" ? row.termFrom : row.date,
                      )}
                    </td>
                    {sale && <td>{row.soldBy || "—"}</td>}
                    <td>{date(row.termTo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {ready && (
          <footer
            className="membership-pagination membership-customer-pagination"
            aria-live="polite"
          >
            <span>
              {data.total
                ? `${(page - 1) * data.pageSize + 1}–${Math.min(page * data.pageSize, data.total)} of ${data.total.toLocaleString("en-US")}`
                : "0 results"}
              {query && ` · ${count.toLocaleString("en-US")} total`}
            </span>
            <div>
              <button
                className="csr-button"
                aria-label="Previous customers"
                disabled={loading || page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="csr-button"
                aria-label="Next customers"
                disabled={loading || page * data.pageSize >= data.total}
                onClick={() => setPage((value) => value + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </footer>
        )}
      </div>
    </dialog>
  );
}

export function MembershipCustomerCard({
  metric,
  label,
  value,
  primary = false,
  period,
  snapshotTime,
  children,
}: {
  metric: MembershipCustomerMetric;
  label: string;
  value: number | null;
  primary?: boolean;
  period: MembershipPeriod;
  snapshotTime: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const available = value != null && snapshotTime != null;
  return (
    <>
      <article
        className={`membership-stat membership-stat--interactive${primary ? " membership-stat--primary" : ""}`}
      >
        {children}
        <button
          type="button"
          className="membership-stat-open"
          disabled={!available}
          aria-label={`View ${label.toLowerCase()} customers`}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <ArrowUpRight size={17} aria-hidden="true" />
        </button>
      </article>
      {open && available && (
        <CustomerDialog
          key={`${metric}:${snapshotTime}`}
          metric={metric}
          label={label}
          count={value}
          period={period}
          snapshotTime={snapshotTime}
          close={() => setOpen(false)}
        />
      )}
    </>
  );
}
