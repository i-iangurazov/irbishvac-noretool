"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  X,
  History,
} from "lucide-react";
import type {
  MembershipPerformance,
  MembershipRecurring,
  MembershipServiceEvent,
  MembershipServiceNote,
  MembershipActivity,
  RecurringStatus,
} from "@irbis/domain";

const number = (value: number) => value.toLocaleString("en-US");
const date = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date(value));
function Pager({
  page,
  total,
  setPage,
}: {
  page: number;
  total: number;
  setPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 10));
  return (
    <div className="membership-pagination">
      <span>
        {total
          ? `${page * 10 + 1}–${Math.min(total, (page + 1) * 10)} of ${number(total)}`
          : "0 entries"}
      </span>
      <div>
        <button
          className="csr-button"
          aria-label="Previous entries"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="csr-button"
          aria-label="Next entries"
          disabled={page + 1 >= pages}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
function ServiceNotes({
  event,
  query,
  close,
}: {
  event: MembershipServiceEvent;
  query: string;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [notes, setNotes] = useState<MembershipServiceNote[]>([]),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const endpoint = `/api/dashboard/call-center/memberships/services/${event.id}/notes?${query}`;
  useEffect(() => {
    dialog.current?.showModal();
    let live = true;
    fetch(endpoint, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((rows) => {
        if (live) setNotes(rows);
      })
      .catch(() => {
        if (live) setError("Notes could not be loaded.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [endpoint]);
  async function save() {
    setBusy(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-membership-note": "1",
        },
        body: JSON.stringify({ body: draft, requestId: requestId.current }),
      });
      if (!response.ok) throw new Error();
      const note = await response.json();
      setNotes((current) => [
        note,
        ...current.filter((row) => row.id !== note.id),
      ]);
      setDraft("");
      requestId.current = null;
    } catch {
      setError("Note was not saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      className="membership-note-dialog"
      ref={dialog}
      onClose={close}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="membership-panel-heading">
        <div>
          <h2>Service notes</h2>
          <p>{event.customerName ?? `Event ${event.id}`}</p>
        </div>
        <button
          className="csr-button"
          aria-label="Close service notes"
          onClick={() => dialog.current?.close()}
        >
          <X size={18} />
        </button>
      </div>
      <div className="membership-note-service">
        <b>{event.name}</b>
        <span>{date(event.date)}</span>
      </div>
      {event.sourceNote && (
        <div className="membership-note">
          <small>ServiceTitan · service memo</small>
          <p>{event.sourceNote}</p>
        </div>
      )}
      <div className="membership-note-list" aria-live="polite">
        {loading ? (
          <p>Loading notes…</p>
        ) : (
          notes.map((note) => (
            <div className="membership-note" key={note.id}>
              <small>
                {note.author} · {timestamp(note.createdAt)} PT
              </small>
              <p>{note.body}</p>
            </div>
          ))
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor="membership-service-note">Add a note</label>
        <textarea
          id="membership-service-note"
          required
          maxLength={2000}
          value={draft}
          disabled={busy}
          onChange={(e) => {
            setDraft(e.target.value);
            requestId.current = null;
          }}
          placeholder="Reason for cancellation, dismissal or follow-up…"
        />
        <div>
          <span>Saved in this dashboard</span>
          <button
            className="csr-button csr-button--primary"
            disabled={busy || !draft.trim()}
            type="submit"
          >
            {busy ? "Saving…" : "Save note"}
          </button>
        </div>
      </form>
      {error && (
        <p className="membership-note-error" role="alert">
          {error}
        </p>
      )}
    </dialog>
  );
}

export function MembershipRecurringPanel({
  recurring,
  seasons,
  query,
  defaultSeason,
  statusLabels,
}: {
  recurring: MembershipRecurring | null;
  seasons: MembershipPerformance["seasons"];
  query: string;
  defaultSeason: "spring" | "fall";
  statusLabels: Record<RecurringStatus, string>;
}) {
  const [season, setSeason] = useState<"period" | "spring" | "fall">(
      defaultSeason,
    ),
    [status, setStatus] = useState<RecurringStatus | "all" | null>(null),
    [page, setPage] = useState(0),
    [type, setType] = useState("all"),
    [selected, setSelected] = useState<MembershipServiceEvent | null>(null);
  const data = season === "period" ? recurring : seasons[season];
  const entries =
    data?.events.filter(
      (e) =>
        (status === "all" || e.status === status) &&
        (type === "all" || e.name === type),
    ) ?? [];
  const changeSeason = (value: "period" | "spring" | "fall") => {
    setSeason(value);
    setStatus(null);
    setPage(0);
    setType("all");
  };
  const select = (value: RecurringStatus | "all") => {
    setStatus(status === value ? null : value);
    setPage(0);
  };
  const statuses = (Object.keys(statusLabels) as RecurringStatus[]).filter(
    (s) =>
      !["contacted", "unreachable", "won", "inProgress"].includes(s) ||
      (data?.statuses[s] ?? 0) > 0,
  );
  return (
    <section className="csr-panel membership-services">
      <div className="membership-panel-heading">
        <h2>
          <CalendarCheck2 size={20} />
          Recurring services
        </h2>
        <div
          className="membership-seasons"
          role="group"
          aria-label="Recurring service period"
        >
          {(
            [
              ["spring", "Spring"],
              ["fall", "Fall"],
              ["period", "Selected dates"],
            ] as const
          ).map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-pressed={season === key}
              onClick={() => changeSeason(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {data ? (
        <>
          <div className="membership-services-overview">
            <div>
              <strong>{number(data.total)}</strong>
              <span>services due</span>
              <small>
                {date(data.period.from)} – {date(data.period.to)}
              </small>
            </div>
            <div>
              <b>{number(data.booked)}</b>
              <span>booked</span>
            </div>
            <div>
              <b>{number(data.outstanding)}</b>
              <span>outstanding</span>
            </div>
            <p>Current service status</p>
          </div>
          <div className="membership-status-grid">
            {statuses.map((key) => (
              <button
                type="button"
                key={key}
                className={`membership-status membership-status--${key}`}
                aria-pressed={status === key}
                onClick={() => select(key)}
              >
                <span>{statusLabels[key]}</span>
                <strong>{number(data.statuses[key])}</strong>
              </button>
            ))}
          </div>
          <div className="membership-service-list-toggle">
            <button
              type="button"
              onClick={() => select("all")}
              aria-expanded={status !== null}
            >
              {status === null
                ? "View service list"
                : status === "all"
                  ? "Hide service list"
                  : "View all services"}
            </button>
          </div>
          {status !== null && (
            <div className="membership-service-list">
              <div className="membership-panel-heading">
                <h3>
                  {status === "all" ? "All services" : statusLabels[status]}{" "}
                  <span>{number(entries.length)}</span>
                </h3>
                <select
                  aria-label="Filter recurring service type"
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">All service types</option>
                  {data.byType.map((t) => (
                    <option key={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="membership-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Service</th>
                      <th>Due</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.slice(page * 10, (page + 1) * 10).map((event) => (
                      <tr key={event.id}>
                        <td>
                          <b>{event.customerName ?? `Event ${event.id}`}</b>
                          <small>{event.membershipType}</small>
                        </td>
                        <td>{event.name}</td>
                        <td>{date(event.date)}</td>
                        <td>
                          <span
                            className={`membership-event-status membership-status--${event.status}`}
                          >
                            {statusLabels[event.status]}
                          </span>
                        </td>
                        <td>
                          <button
                            className="csr-button"
                            aria-label={`Notes for ${event.customerName ?? event.id}`}
                            onClick={() => setSelected(event)}
                          >
                            <MessageSquare size={16} />
                            Notes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!entries.length && (
                  <p className="membership-empty-inline">
                    No services in this view.
                  </p>
                )}
              </div>
              <Pager page={page} total={entries.length} setPage={setPage} />
            </div>
          )}
        </>
      ) : (
        <p className="membership-empty-inline">
          Service data is temporarily unavailable.
        </p>
      )}
      {selected && (
        <ServiceNotes
          event={selected}
          query={query}
          close={() => setSelected(null)}
        />
      )}
    </section>
  );
}

export function MembershipActivityPanel({
  rows,
}: {
  rows: MembershipActivity[] | null;
}) {
  const [status, setStatus] = useState("all"),
    [page, setPage] = useState(0);
  const visible = (rows ?? []).filter(
    (row) => status === "all" || row.status === status,
  );
  return (
    <section className="csr-panel membership-activity">
      <details>
        <summary>
          <span>
            <History size={20} />
            Membership activity
          </span>
          <span>
            {rows == null ? "Unavailable" : `${number(rows.length)} changes`}
          </span>
        </summary>
        <div className="membership-panel-heading">
          <p>Status changes during the selected dates</p>
          <select
            aria-label="Filter membership activity"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            {[
              ["all", "All changes"],
              ["Canceled", "Cancelled"],
              ["Expired", "Expired"],
              ["Deleted", "Removed"],
              ["Suspended", "Suspended"],
              ["Active", "Activated"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="membership-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Membership</th>
                <th>Change</th>
                <th>Date · PT</th>
                <th>Source note</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(page * 10, (page + 1) * 10).map((row) => (
                <tr key={row.id}>
                  <td>
                    <b>
                      {row.customerName ?? `Membership ${row.membershipId}`}
                    </b>
                  </td>
                  <td>{row.membershipType || "—"}</td>
                  <td>
                    <span>
                      {row.previousStatus} →{" "}
                      {row.status === "Deleted" ? "Removed" : row.status}
                    </span>
                  </td>
                  <td>{timestamp(row.changedAt)}</td>
                  <td>{row.note || "No reason recorded"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <p className="membership-empty-inline">
              {rows === null
                ? "Activity is temporarily unavailable."
                : "No changes in this view."}
            </p>
          )}
        </div>
        <Pager page={page} total={visible.length} setPage={setPage} />
        <p className="membership-activity-footnote">
          Removed records can include corrections. An estimate withdrawal is
          confirmed only when recorded in the source.
        </p>
      </details>
    </section>
  );
}
