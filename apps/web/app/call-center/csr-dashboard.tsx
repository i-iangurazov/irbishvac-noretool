import type { CSSProperties, ReactNode } from "react";
import type { CsrPerformanceDashboard, CsrPerformanceRow } from "@irbis/domain";
import { DashboardShell, DataFreshnessBadge, FilterBar } from "@irbis/ui";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Info,
  LayoutGrid,
  List,
  MessageSquare,
  Phone,
  PhoneMissed,
  ShieldCheck,
  Trophy,
  UserRound,
  XCircle,
} from "lucide-react";
import { navItems } from "../../lib/api";
import { getBrandLogoUrl, resolveStaffHeadshotUrl } from "../../lib/assets";
import {
  buildDashboardQueryString,
  buildKioskHref,
  buildPresetHref,
  buildTvModeHref,
  type ResolvedDashboardFilters,
} from "../../lib/dashboard-filters";
import { CsrAvatar, CsrPeriodPicker, CsrRefresh } from "./csr-controls";
import "./csr.css";

const num = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("en-US");
const rate = (value: number | null | undefined) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;
const hints = {
  booking:
    "Inbound jobs booked ÷ lead calls. Text leads and manually created jobs are excluded from this call conversion rate.",
  text: "Qualified text and form leads (Good or Mid) in the Call Center Master Sheet, attributed to the receiving CSR. Phone calls are excluded.",
  jobs: "Unique jobs created in the selected period, attributed to Booked By in ServiceTitan’s Job Detail By CSR report. Includes all booking channels.",
  cancelled:
    "Jobs booked in the selected period whose current status is Canceled. Cancellation rate = canceled jobs ÷ all jobs booked.",
  missed:
    "ServiceTitan reports these calls as Abandoned without an assigned employee. A per-CSR count is not available from this source.",
  memberships:
    "Memberships sold in the selected period, attributed to Sold By in ServiceTitan’s Membership Sales Detail report.",
};

function Hint({ children }: { children: ReactNode }) {
  return (
    <span
      className="csr-hint"
      tabIndex={0}
      aria-label={
        typeof children === "string" ? children : "Metric information"
      }
    >
      <Info size={14} />
      <span role="tooltip">{children}</span>
    </span>
  );
}
function MetricLabel({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <span className="csr-metric-label">
      {children}
      {hint ? <Hint>{hint}</Hint> : null}
    </span>
  );
}
function sourceHint(data: CsrPerformanceDashboard) {
  return data.sources.text.status === "partial"
    ? `Text leads are unavailable for the full selected range. Missing months: ${data.sources.text.missingMonths?.join(", ")}.`
    : data.sources.text.status === "unavailable"
      ? "Text lead data is not available for this period."
      : hints.text;
}
function Stat({
  label,
  value,
  icon,
  hint,
  accent,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <article className={`csr-kpi ${accent ? "csr-kpi--accent" : ""}`}>
      <div>
        <MetricLabel {...(hint ? { hint } : {})}>{label}</MetricLabel>
        <strong>{value}</strong>
      </div>
      <span className="csr-kpi__icon" aria-hidden="true">
        {icon}
      </span>
    </article>
  );
}
function CountsPanel({
  title,
  icon,
  entries,
  empty,
  total,
}: {
  title: string;
  icon: ReactNode;
  entries: Array<{ name: string; count: number }>;
  empty: string;
  total: number | null;
}) {
  const maximum = entries[0]?.count ?? 1;
  const visible = entries.slice(0, 4);
  const rest = entries.slice(4);
  return (
    <section className="csr-panel csr-breakdown">
      <div className="csr-panel__heading">
        <h2>
          {icon}
          {title}
        </h2>
        <span className="csr-count">{num(total)}</span>
      </div>
      {entries.length ? (
        <>
          <div className="csr-bars">
            {visible.map((entry) => (
              <div className="csr-bar" key={entry.name}>
                <div>
                  <span>{entry.name}</span>
                  <strong>{num(entry.count)}</strong>
                </div>
                <span className="csr-bar__track">
                  <span
                    style={{ width: `${(entry.count / maximum) * 100}%` }}
                  />
                </span>
              </div>
            ))}
          </div>
          {rest.length ? (
            <details className="csr-more">
              <summary>
                All {entries.length}{" "}
                {title.includes("source") ? "sources" : "job types"}
                <ChevronRight size={14} />
              </summary>
              <div>
                {rest.map((entry) => (
                  <div className="csr-more__row" key={entry.name}>
                    <span>{entry.name}</span>
                    <strong>{num(entry.count)}</strong>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <p className="csr-empty-note">{empty}</p>
      )}
    </section>
  );
}
function PersonCard({
  row,
  data,
}: {
  row: CsrPerformanceRow;
  data: CsrPerformanceDashboard;
}) {
  const hasCalls = row.leadsReceived > 0;
  const first = row.rankByLeadCalls === 1 && hasCalls;
  return (
    <article
      className={`csr-person ${first ? "csr-person--first" : ""}`}
      data-csr-card
    >
      <div className="csr-person__profile">
        <CsrAvatar name={row.name} src={resolveStaffHeadshotUrl(row.name)} />
        <div className="csr-person__identity">
          <h2>{row.name}</h2>
          <span>
            {row.role === "Admin"
              ? "CSR manager"
              : row.role === "CSR"
                ? "Customer service"
                : (row.role ?? "Customer service")}
          </span>
        </div>
        <span
          className="csr-person__rank"
          aria-label={`Rank ${row.rankByLeadCalls}`}
        >
          {first ? <Trophy size={17} /> : `#${row.rankByLeadCalls}`}
        </span>
      </div>
      <div className="csr-person__rate">
        <div>
          <MetricLabel hint={hints.booking}>Booking rate</MetricLabel>
          <strong>{hasCalls ? rate(row.callBookingRate) : "—"}</strong>
        </div>
        <div
          className="csr-rate-ring"
          style={
            {
              "--rate": `${Math.min(1, Math.max(0, row.callBookingRate)) * 100}%`,
            } as CSSProperties
          }
        >
          <Phone size={23} />
        </div>
      </div>
      <div className="csr-person__leads">
        <div className="csr-person__leads-title">
          <MetricLabel hint="Lead calls from ServiceTitan plus qualified text leads assigned to this CSR.">
            Leads received
          </MetricLabel>
          <strong>{num(row.totalLeads)}</strong>
        </div>
        <div className="csr-person__lead-split">
          <div>
            <Phone size={15} />
            <span>Lead calls</span>
            <b>{num(row.leadsReceived)}</b>
          </div>
          <div>
            <MessageSquare size={15} />
            <MetricLabel hint={sourceHint(data)}>Text leads</MetricLabel>
            <b>{num(row.textLeads)}</b>
          </div>
        </div>
      </div>
      <dl className="csr-person__metrics">
        <div>
          <dt>
            <CalendarCheck2 size={16} />
            <MetricLabel hint={hints.jobs}>Booked jobs</MetricLabel>
          </dt>
          <dd>
            {num(
              data.sources.jobs.status === "available"
                ? row.totalJobsBooked
                : null,
            )}
          </dd>
        </div>
        <div>
          <dt>
            <PhoneMissed size={16} />
            <MetricLabel hint={hints.missed}>Missed calls</MetricLabel>
          </dt>
          <dd className="csr-unavailable">{num(row.missedCalls)}</dd>
        </div>
        <div>
          <dt>
            <XCircle size={16} />
            <MetricLabel hint={hints.cancelled}>Cancelled jobs</MetricLabel>
          </dt>
          <dd>{num(row.cancelledJobs)}</dd>
        </div>
        <div>
          <dt>
            <ArrowDownLeft size={16} />
            <MetricLabel hint={hints.cancelled}>Cancellation rate</MetricLabel>
          </dt>
          <dd>
            {row.cancelledJobs == null || !row.totalJobsBooked
              ? "—"
              : rate(row.cancellationRate)}
          </dd>
        </div>
      </dl>
      <div className="csr-person__memberships">
        <span>
          <ShieldCheck size={20} />
          <MetricLabel hint={hints.memberships}>Memberships sold</MetricLabel>
        </span>
        <strong>{num(row.membershipsSold)}</strong>
      </div>
    </article>
  );
}

export function CsrDashboard({
  data,
  filters,
  view,
}: {
  data: CsrPerformanceDashboard;
  filters: ResolvedDashboardFilters;
  view: "summary" | "by-csr";
}) {
  const path = `/call-center/${view}`;
  const query = buildDashboardQueryString(filters);
  const pageCount = Math.max(1, Math.ceil(data.rowsRanked.length / 4));
  const page = Math.min(filters.page, pageCount);
  const visible = data.rowsRanked.slice((page - 1) * 4, page * 4);
  const hasData = data.version === 2 && Boolean(data.snapshotTime);
  const periodLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${filters.to}T12:00:00Z`));
  const label = filters.customRange
    ? `${filters.fromLabel} – ${filters.toLabel}`
    : filters.preset === "ytd"
      ? `${filters.to.slice(0, 4)} YTD`
      : `${periodLabel} MTD`;
  const s = data.summary;
  return (
    <DashboardShell
      title="CSR Performance"
      navItems={navItems}
      activePath={path}
      brandLogoUrl={getBrandLogoUrl()}
      tvMode={filters.tvMode}
      kioskMode={filters.kioskMode}
      navQueryString={query}
      rotationPage={
        view === "by-csr" && filters.tvMode
          ? { current: page, total: pageCount }
          : undefined
      }
      rotationIntervalMs={15_000}
      rotationMinViewportWidth={1024}
      tvMenu={{
        enabled: filters.tvMode,
        toggleHref: buildTvModeHref(path, filters, !filters.tvMode),
        kioskMode: filters.kioskMode,
        kioskHref: buildKioskHref(path, filters, !filters.kioskMode),
      }}
      contentClassName={`csr-dashboard csr-dashboard--${view}`}
      headerContent={
        <div className="dashboard-header-tools flex flex-wrap items-center justify-end">
          <FilterBar
            from={filters.fromLabel}
            to={filters.toLabel}
            presets={[
              {
                label: "YTD",
                href: buildPresetHref(path, "ytd", filters),
                active: filters.preset === "ytd" && !filters.customRange,
              },
              {
                label: "MTD",
                href: buildPresetHref(path, "mtd", filters),
                active: filters.preset === "mtd" && !filters.customRange,
              },
            ]}
          />
          <DataFreshnessBadge value={data.snapshotTime} />
        </div>
      }
    >
      <div className="csr-content">
        <div className="csr-toolbar">
          <div>
            <p className="csr-eyebrow">
              <Headphones size={14} />
              CALL CENTER
            </p>
            <h1>
              CSR Performance
              <span>
                {view === "summary"
                  ? ""
                  : `${data.rowsRanked.length} team members`}
              </span>
            </h1>
          </div>
          <div className="csr-toolbar__actions">
            <nav className="csr-tabs" aria-label="Call center views">
              <a
                aria-current={view === "summary" ? "page" : undefined}
                href={`/call-center/summary?${query}`}
              >
                <List size={16} />
                Summary
              </a>
              <a
                aria-current={view === "by-csr" ? "page" : undefined}
                href={`/call-center/by-csr?${query}`}
              >
                <LayoutGrid size={16} />
                By CSR
              </a>
            </nav>
            <CsrPeriodPicker
              from={filters.from}
              to={filters.to}
              query={query}
              label={label}
            />
            <CsrRefresh pending={!hasData} />
          </div>
        </div>
        {!hasData ? (
          <section className="csr-panel csr-empty">
            <Headphones size={32} />
            <h2>Preparing this period</h2>
            <p>The dashboard will update when the data is ready.</p>
          </section>
        ) : (
          <>
            <section className="csr-kpis" aria-label="Team totals">
              <Stat
                label="Lead calls"
                value={num(s.leadCalls)}
                icon={<Phone size={22} />}
                hint="Inbound lead calls handled by the CSR team in ServiceTitan."
              />
              <Stat
                label="Text leads"
                value={num(s.textLeads)}
                icon={<MessageSquare size={22} />}
                hint={sourceHint(data)}
              />
              <Stat
                label="Booking rate"
                value={s.leadCalls ? rate(s.bookingRate) : "—"}
                icon={<ArrowUpRight size={22} />}
                hint={hints.booking}
                accent
              />
              <Stat
                label="Booked jobs"
                value={num(
                  data.sources.jobs.status === "available" ? s.totalJobs : null,
                )}
                icon={<CalendarCheck2 size={22} />}
                hint={hints.jobs}
              />
            </section>
            {view === "by-csr" ? (
              <>
                <section
                  className="csr-people"
                  aria-label="CSR performance cards"
                >
                  {visible.map((row) => (
                    <PersonCard key={row.name} row={row} data={data} />
                  ))}
                </section>
                <div className="csr-pagination">
                  <span>
                    Showing {(page - 1) * 4 + 1}–
                    {Math.min(page * 4, data.rowsRanked.length)} of{" "}
                    {data.rowsRanked.length}
                  </span>
                  <nav aria-label="CSR pages">
                    {page > 1 ? (
                      <a
                        className="csr-button"
                        href={`${path}?${query}&page=${page - 1}`}
                        aria-label="Previous page"
                      >
                        <ChevronLeft size={18} />
                      </a>
                    ) : (
                      <span className="csr-button" aria-disabled="true">
                        <ChevronLeft size={18} />
                      </span>
                    )}
                    {Array.from({ length: pageCount }, (_, i) => (
                      <a
                        key={i}
                        className="csr-button"
                        href={`${path}?${query}&page=${i + 1}`}
                        aria-current={page === i + 1 ? "page" : undefined}
                      >
                        {i + 1}
                      </a>
                    ))}
                    {page < pageCount ? (
                      <a
                        className="csr-button"
                        href={`${path}?${query}&page=${page + 1}`}
                        aria-label="Next page"
                      >
                        <ChevronRight size={18} />
                      </a>
                    ) : (
                      <span className="csr-button" aria-disabled="true">
                        <ChevronRight size={18} />
                      </span>
                    )}
                  </nav>
                  <span>
                    {filters.tvMode
                      ? "Auto-rotate · 15 sec"
                      : "Ranked by call booking rate"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="csr-summary-grid">
                  <section className="csr-panel csr-scorecard">
                    <div className="csr-panel__heading">
                      <h2>
                        <Trophy size={21} />
                        CSR scorecard
                      </h2>
                      <a href={`/call-center/by-csr?${query}`}>
                        View cards
                        <ArrowUpRight size={16} />
                      </a>
                    </div>
                    <div className="csr-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Team member</th>
                            <th>Lead calls</th>
                            <th>
                              <MetricLabel hint={sourceHint(data)}>
                                Text leads
                              </MetricLabel>
                            </th>
                            <th>Booked</th>
                            <th>
                              <MetricLabel hint={hints.booking}>
                                Rate
                              </MetricLabel>
                            </th>
                            <th>
                              <MetricLabel hint={hints.memberships}>
                                Memberships
                              </MetricLabel>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.rowsRanked.map((row, i) => (
                            <tr
                              key={row.name}
                              className={
                                i === 0 ? "csr-scorecard__leader" : undefined
                              }
                            >
                              <th scope="row">
                                <span className="csr-table-person">
                                  <span className="csr-table-rank">
                                    {i + 1}
                                  </span>
                                  <CsrAvatar
                                    name={row.name}
                                    src={resolveStaffHeadshotUrl(row.name)}
                                  />
                                  <span>{row.name}</span>
                                </span>
                              </th>
                              <td>{num(row.leadsReceived)}</td>
                              <td>{num(row.textLeads)}</td>
                              <td>
                                {num(
                                  data.sources.jobs.status === "available"
                                    ? row.totalJobsBooked
                                    : null,
                                )}
                              </td>
                              <td>
                                <span className="csr-rate-cell">
                                  {row.leadsReceived
                                    ? rate(row.callBookingRate)
                                    : "—"}
                                </span>
                              </td>
                              <td>{num(row.membershipsSold)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th>CSR team</th>
                            <td>{num(s.leadCalls)}</td>
                            <td>{num(s.textLeads)}</td>
                            <td>
                              {num(
                                data.sources.jobs.status === "available"
                                  ? s.totalJobs
                                  : null,
                              )}
                            </td>
                            <td>{s.leadCalls ? rate(s.bookingRate) : "—"}</td>
                            <td>{num(s.membershipsSold)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="csr-scorecard__footer">
                      <span>
                        <UserRound size={14} />
                        {data.rows.length} team members
                      </span>
                      <span>
                        Call booking rate<Hint>{hints.booking}</Hint>
                      </span>
                    </div>
                  </section>
                  <div className="csr-summary-side">
                    <CountsPanel
                      title="Text leads by source"
                      icon={<MessageSquare size={20} />}
                      entries={data.textSources}
                      empty={
                        data.sources.text.status === "partial"
                          ? "Full-period text data is unavailable."
                          : "No text lead data for this period."
                      }
                      total={s.textLeads}
                    />
                    <CountsPanel
                      title="Jobs booked by type"
                      icon={<CalendarCheck2 size={20} />}
                      entries={data.jobsByType}
                      empty="Job breakdown is not available yet."
                      total={
                        data.sources.jobs.status === "available"
                          ? s.totalJobs
                          : null
                      }
                    />
                  </div>
                </div>
                <section
                  className="csr-outcomes"
                  aria-label="Additional performance"
                >
                  <div>
                    <span className="csr-outcomes__icon">
                      <PhoneMissed size={20} />
                    </span>
                    <div>
                      <MetricLabel hint={hints.missed}>
                        Missed calls
                      </MetricLabel>
                      <strong>{num(s.missedCalls)}</strong>
                    </div>
                    <span className="csr-outcomes__note">Unassigned</span>
                  </div>
                  <div>
                    <span className="csr-outcomes__icon">
                      <XCircle size={20} />
                    </span>
                    <div>
                      <MetricLabel hint={hints.cancelled}>
                        Cancelled jobs
                      </MetricLabel>
                      <strong>{num(s.cancelledJobs)}</strong>
                    </div>
                  </div>
                  <div>
                    <span className="csr-outcomes__icon">
                      <ArrowDownLeft size={20} />
                    </span>
                    <div>
                      <MetricLabel hint={hints.cancelled}>
                        Cancellation rate
                      </MetricLabel>
                      <strong>
                        {s.cancelledJobs == null || !s.totalJobs
                          ? "—"
                          : rate(s.cancellationRate)}
                      </strong>
                    </div>
                  </div>
                  <div>
                    <span className="csr-outcomes__icon">
                      <ShieldCheck size={20} />
                    </span>
                    <div>
                      <MetricLabel hint={hints.memberships}>
                        Memberships sold
                      </MetricLabel>
                      <strong>{num(s.membershipsSold)}</strong>
                    </div>
                  </div>
                </section>
              </>
            )}
            {view === "summary" && data.unassignedTextLeads ? (
              <p className="csr-data-note">
                {num(data.unassignedTextLeads)} text leads have no matching CSR
                <Hint>
                  These leads are excluded from team and individual totals until
                  a CSR is assigned in the source sheet.
                </Hint>
              </p>
            ) : null}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
