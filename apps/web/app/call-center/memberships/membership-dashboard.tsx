import type { CSSProperties, ReactNode } from "react";
import type { MembershipPerformance } from "@irbis/domain";
import { MEMBERSHIP_DEPARTMENTS } from "@irbis/domain";
import { DashboardShell, DataFreshnessBadge, FilterBar } from "@irbis/ui";
import {
  CalendarCheck2,
  CircleHelp,
  LayoutGrid,
  List,
  RefreshCw,
  ShieldCheck,
  Target,
  UserRoundPlus,
  Users,
  XCircle,
} from "lucide-react";
import { navItems } from "../../../lib/api";
import { getBrandLogoUrl, resolveStaffHeadshotUrl } from "../../../lib/assets";
import {
  buildDashboardQueryString,
  buildKioskHref,
  buildPresetHref,
  buildTvModeHref,
  type ResolvedDashboardFilters,
} from "../../../lib/dashboard-filters";
import { CsrPeriodPicker } from "../csr-controls";
import { MembershipRefresh, MembershipSalesTable } from "./membership-controls";
import "../csr.css";
import "./membership.css";

const num = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("en-US");
const rate = (value: number | null) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;
function Hint({ children }: { children: string }) {
  return (
    <span className="csr-hint" tabIndex={0} aria-label={children}>
      <CircleHelp size={14} />
      <span role="tooltip">{children}</span>
    </span>
  );
}
function Stat({
  label,
  value,
  icon,
  hint,
  primary = false,
}: {
  label: string;
  value: number | null;
  icon: ReactNode;
  hint: string;
  primary?: boolean;
}) {
  return (
    <article
      className={`membership-stat${primary ? " membership-stat--primary" : ""}`}
    >
      <div>
        <span>
          {label}
          <Hint>{hint}</Hint>
        </span>
        <i>{icon}</i>
      </div>
      <strong>{num(value)}</strong>
    </article>
  );
}
function Health({
  title,
  value,
  detail,
  hint,
  tone = "blue",
}: {
  title: string;
  value: number | null;
  detail: string;
  hint: string;
  tone?: "blue" | "amber";
}) {
  const progress = Math.max(0, Math.min(1, value ?? 0));
  return (
    <section
      className={`csr-panel membership-health membership-health--${tone}`}
    >
      <h2>
        {title}
        <Hint>{hint}</Hint>
      </h2>
      <div className="membership-health__value">
        <strong>{rate(value)}</strong>
        <svg width="66" height="66" viewBox="0 0 66 66" aria-hidden="true">
          <circle
            cx="33"
            cy="33"
            r="27"
            fill="none"
            stroke="#edf1f7"
            strokeWidth="6"
          />
          <circle
            cx="33"
            cy="33"
            r="27"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${progress * 169.65} 169.65`}
            transform="rotate(-90 33 33)"
          />
        </svg>
      </div>
      <p>{detail}</p>
    </section>
  );
}

export function MembershipDashboard({
  data,
  filters,
}: {
  data: MembershipPerformance;
  filters: ResolvedDashboardFilters;
}) {
  const path = "/call-center/memberships",
    query = buildDashboardQueryString(filters);
  const label = filters.customRange
    ? `${filters.fromLabel} – ${filters.toLabel}`
    : filters.preset === "ytd"
      ? `${filters.to.slice(0, 4)} YTD`
      : `${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${filters.to}T12:00:00Z`))} MTD`;
  const s = data.summary,
    recurring = data.recurring;
  const ready = Boolean(data.snapshotTime);
  const stale = Boolean(
    data.snapshotTime &&
    Date.now() - Date.parse(data.snapshotTime) > 60 * 60_000,
  );
  const departments = data.departments.filter(
    (d) => d.id !== "other" || d.newSales || d.renewals,
  );
  const maxSales = Math.max(1, ...departments.map((d) => d.newSales));
  return (
    <DashboardShell
      title="Membership Performance"
      navItems={navItems}
      activePath={path}
      brandLogoUrl={getBrandLogoUrl()}
      tvMode={filters.tvMode}
      kioskMode={filters.kioskMode}
      navQueryString={query}
      tvMenu={{
        enabled: filters.tvMode,
        toggleHref: buildTvModeHref(path, filters, !filters.tvMode),
        kioskMode: filters.kioskMode,
        kioskHref: buildKioskHref(path, filters, !filters.kioskMode),
      }}
      contentClassName="csr-dashboard membership-dashboard"
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
      <div className="csr-content membership-content">
        <div className="csr-toolbar membership-toolbar">
          <h1>Membership Performance</h1>
          <div className="csr-toolbar__actions">
            <CsrPeriodPicker
              key={query}
              from={filters.from}
              to={filters.to}
              query={query}
              label={label}
            />
            <MembershipRefresh
              query={filters.apiQueryString}
              pending={!ready}
            />
          </div>
        </div>
        <nav className="membership-view-nav" aria-label="Call center views">
          <a href={`/call-center/summary?${query}`}>
            <List size={16} />
            Summary
          </a>
          <a href={`/call-center/by-csr?${query}`}>
            <LayoutGrid size={16} />
            By CSR
          </a>
          <a href={`${path}?${query}`} aria-current="page">
            <ShieldCheck size={16} />
            Memberships
          </a>
        </nav>
        {!ready ? (
          <section className="csr-panel csr-empty">
            <ShieldCheck size={32} />
            <h2>Preparing this period</h2>
            <p>The dashboard will update when the data is ready.</p>
          </section>
        ) : (
          <>
            {(data.state === "partial" || stale) && (
              <p className="membership-source-notice" role="status">
                {stale
                  ? "Showing the last available update."
                  : "Some metrics are temporarily unavailable."}
              </p>
            )}
            <section className="membership-kpis" aria-label="Membership totals">
              <Stat
                primary
                label="Active members"
                value={s.activeMembers}
                icon={<Users size={23} />}
                hint="Active memberships at the end of the selected period, including memberships on inactive plan types. Counts memberships, not unique customers."
              />
              <Stat
                label="New sales"
                value={s.newSales}
                icon={<UserRoundPlus size={23} />}
                hint="New Sale memberships with a Sold On date in the selected period. Renewals and deleted records are excluded. These totals match the department and representative sales below."
              />
              <Stat
                label="Renewals"
                value={s.renewals}
                icon={<RefreshCw size={23} />}
                hint="Renewal memberships sold in the selected period, based on Sold On. Deleted records are excluded. Early renewals may belong to a different expiration cohort."
              />
              <Stat
                label="Cancellations"
                value={s.cancellations}
                icon={<XCircle size={23} />}
                hint="Memberships whose last status change in the selected period was Canceled, as reported by ServiceTitan Membership Summary."
              />
            </section>
            <div className="membership-health-grid">
              <Health
                title="Renewal rate"
                value={s.renewalRate}
                detail={
                  s.eligibleRenewals == null
                    ? "Cohort data unavailable"
                    : s.eligibleRenewals
                      ? `${num(s.renewedEligible)} of ${num(s.eligibleRenewals)} eligible renewed`
                      : "No eligible renewals in this period"
                }
                hint="Fixed-term memberships expiring in the selected period, excluding deleted records and cancellations before expiration. Rate = those linked to a renewal sold by period end ÷ eligible memberships. Ongoing monthly plans are excluded."
              />
              <Health
                title="Cancellation rate"
                tone="amber"
                value={s.cancellationRate}
                detail={
                  s.cancellations == null || s.activeAtStart == null
                    ? "Status data unavailable"
                    : `${num(s.cancellations)} cancelled · ${num(s.activeAtStart)} at period start`
                }
                hint="Cancellations in the selected period ÷ memberships active at the start of the period. A zero starting balance has no calculable rate."
              />
              <section className="csr-panel membership-recurring">
                <div className="membership-panel-heading">
                  <h2>
                    <CalendarCheck2 size={20} />
                    Recurring services
                  </h2>
                  <Hint>
                    Service events due within the selected dates. Booked
                    includes scheduled, in-progress, on-hold and completed jobs.
                    Cancelled jobs return to outstanding; dismissed events are
                    separate.
                  </Hint>
                </div>
                <dl>
                  <div>
                    <dt>Total due</dt>
                    <dd>{num(recurring?.total)}</dd>
                  </div>
                  <div>
                    <dt>
                      <span className="membership-dot" />
                      Booked
                    </dt>
                    <dd>{num(recurring?.booked)}</dd>
                  </div>
                  <div>
                    <dt>
                      <span className="membership-dot membership-dot--amber" />
                      Outstanding
                    </dt>
                    <dd>{num(recurring?.outstanding)}</dd>
                  </div>
                </dl>
                <div className="membership-recurring__track" aria-hidden="true">
                  {recurring && recurring.total > 0 && (
                    <>
                      <i
                        style={{
                          width: `${(recurring.booked / recurring.total) * 100}%`,
                        }}
                      />
                      <i
                        style={{
                          width: `${(recurring.outstanding / recurring.total) * 100}%`,
                        }}
                      />
                      <i
                        style={{
                          width: `${(recurring.dismissed / recurring.total) * 100}%`,
                        }}
                      />
                    </>
                  )}
                </div>
                <p>
                  {!recurring ? (
                    "Service data unavailable"
                  ) : !recurring.total ? (
                    "No services due in this period"
                  ) : (
                    <>
                      {num(recurring.completed)} completed
                      {recurring.dismissed > 0 && (
                        <span>{num(recurring.dismissed)} dismissed</span>
                      )}
                    </>
                  )}
                </p>
                {recurring && recurring.byType.length > 0 && (
                  <details className="membership-service-details">
                    <summary>By service type</summary>
                    <div>
                      {recurring.byType.map((type) => (
                        <div key={type.name}>
                          <span>{type.name}</span>
                          <b>
                            {type.booked} / {type.total}
                            <small>booked</small>
                          </b>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </section>
            </div>
            <div className="membership-detail-grid">
              {data.sources.sales ? (
                <MembershipSalesTable
                  rows={data.representatives.map((row) => ({
                    ...row,
                    photoUrl: row.id.startsWith("unmapped-")
                      ? null
                      : resolveStaffHeadshotUrl(row.name),
                  }))}
                  goals={data.goals}
                  departmentLabels={MEMBERSHIP_DEPARTMENTS}
                />
              ) : (
                <section className="csr-panel membership-panel-empty">
                  <Target size={25} />
                  <h2>Sales goals</h2>
                  <p>Sales data is temporarily unavailable.</p>
                </section>
              )}
              <section className="csr-panel membership-departments">
                <div className="membership-panel-heading">
                  <h2>Sales by department</h2>
                  <Hint>
                    New memberships attributed to Sold By. HVAC and Plumbing use
                    each technician’s department. Other and unassigned sales
                    remain visible. Renewals are shown separately.
                  </Hint>
                </div>
                <div className="membership-department-total">
                  <strong>{num(s.newSales)}</strong>
                  <span>new memberships</span>
                </div>
                {departments.map((d, i) => (
                  <div
                    className="membership-department"
                    key={d.id}
                    style={
                      {
                        "--department-color": [
                          "#326ec3",
                          "#5489d0",
                          "#8badde",
                          "#b9c7dc",
                        ][i],
                      } as CSSProperties
                    }
                  >
                    <div>
                      <span>{d.label}</span>
                      <b>{num(d.newSales)}</b>
                    </div>
                    <div className="membership-track">
                      <i
                        style={{ width: `${(d.newSales / maxSales) * 100}%` }}
                      />
                    </div>
                    <small>{num(d.renewals)} renewals</small>
                  </div>
                ))}
                {!data.sources.sales && (
                  <p className="membership-empty-inline">
                    Sales data unavailable
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
