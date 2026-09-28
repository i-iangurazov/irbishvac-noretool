import type { CSSProperties, ReactNode } from "react";
import type { MembershipPerformance } from "@irbis/domain";
import { MEMBERSHIP_DEPARTMENTS, RECURRING_STATUS_LABELS } from "@irbis/domain";
import { DashboardShell, DataFreshnessBadge, FilterBar } from "@irbis/ui";
import {
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  CircleHelp,
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
import {
  MembershipRecurringPanel,
  MembershipActivityPanel,
} from "./membership-services";
import "../csr.css";
import "./membership.css";

const num = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("en-US");
const money = (value: number | null) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
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
  detail,
}: {
  label: string;
  value: number | null;
  icon: ReactNode;
  hint: string;
  primary?: boolean;
  detail?: string | undefined;
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
      {detail && <small>{detail}</small>}
    </article>
  );
}
function Health({
  title,
  value,
  detail,
  hint,
  tone = "blue",
  threshold,
  upperLimit = false,
}: {
  title: string;
  value: number | null;
  detail: string;
  hint: string;
  tone?: "blue" | "amber";
  threshold?: number | null;
  upperLimit?: boolean;
}) {
  const breached =
    value != null &&
    threshold != null &&
    (upperLimit ? value > threshold : value < threshold);
  const progress = Math.max(0, Math.min(1, value ?? 0));
  return (
    <section
      className={`csr-panel membership-health membership-health--${tone}${breached ? " membership-health--alert" : ""}`}
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
      {threshold != null && (
        <small className="membership-health-target">
          {upperLimit ? "Limit" : "Target"} {rate(threshold)}
          {breached ? (upperLimit ? " · Above limit" : " · Below target") : ""}
        </small>
      )}
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
  const path = "/memberships",
    query = buildDashboardQueryString(filters);
  const label = filters.customRange
    ? filters.from === filters.to
      ? filters.toLabel
      : `${filters.fromLabel} – ${filters.toLabel}`
    : filters.preset === "ytd"
      ? `${filters.to.slice(0, 4)} YTD`
      : `${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${filters.to}T12:00:00Z`))} MTD`;
  const s = data.summary;
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
              allowSingleDate
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
                detail={`As of ${filters.toLabel}`}
                label="Active members"
                value={s.activeMembers}
                icon={<Users size={23} />}
                hint="Active memberships at the end of the selected period, including memberships on inactive plan types. Counts memberships, not unique customers."
              />
              <Stat
                label="New sales"
                detail={
                  data.salesByMarket
                    ? `${num(data.salesByMarket.residential)} residential · ${num(data.salesByMarket.commercial)} commercial${data.salesByMarket.other ? ` · ${num(data.salesByMarket.other)} other` : ""}`
                    : undefined
                }
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
              <Stat
                label="Expired"
                value={s.expired}
                icon={<CalendarClock size={23} />}
                hint="Memberships whose last status change during the selected dates was Expired in ServiceTitan Membership Summary. Separate from early cancellations; renewals are tracked independently."
              />
            </section>
            <div className="membership-health-grid">
              <Health
                title="Renewal rate"
                threshold={data.thresholds.renewalTarget}
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
                threshold={data.thresholds.cancellationLimit}
                upperLimit
                tone="amber"
                value={s.cancellationRate}
                detail={
                  s.cancellations == null || s.activeAtStart == null
                    ? "Status data unavailable"
                    : `${num(s.cancellations)} cancelled · ${num(s.activeAtStart)} at period start`
                }
                hint="Cancellations in the selected period ÷ memberships active at the start of the period. A zero starting balance has no calculable rate."
              />
              <section className="csr-panel membership-revenue">
                <h2>
                  <Banknote size={19} />
                  Membership sales value
                  <Hint>
                    Sale and renewal item prices for memberships sold during the
                    selected dates. Includes free and discounted memberships;
                    excludes deleted records. This is sales value, not cash
                    collected or deferred-revenue recognition.
                  </Hint>
                </h2>
                <strong>{money(data.revenue.total)}</strong>
                <dl>
                  <div>
                    <dt>New sales</dt>
                    <dd>{money(data.revenue.newSales)}</dd>
                  </div>
                  <div>
                    <dt>Renewals</dt>
                    <dd>{money(data.revenue.renewals)}</dd>
                  </div>
                </dl>
              </section>
              <section className="csr-panel membership-revenue">
                <h2>
                  <BriefcaseBusiness size={19} />
                  Member job revenue
                  <Hint>
                    Revenue From Members report filtered by job completion date,
                    including adjustment invoices. Membership sale and renewal
                    line items are removed using each invoice’s membership type.
                    Invoice discounts are retained. Membership status follows
                    the source report’s member cohort.
                  </Hint>
                </h2>
                <strong>{money(data.revenue.memberJobs)}</strong>
                <p>
                  {data.revenue.jobs == null
                    ? "Invoice data unavailable"
                    : `${num(data.revenue.jobs)} completed jobs`}
                </p>
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
                    Sales attributed to Sold By. CSR, HVAC Service, HVAC
                    Maintenance and Plumbing Service are separate. Installation,
                    advisors and unassigned sales remain in Other. Renewals are
                    shown separately.
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
                          "#9ab8dd",
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
            <MembershipRecurringPanel
              key={query}
              recurring={data.recurring}
              seasons={data.seasons}
              query={filters.apiQueryString}
              defaultSeason={
                Number(filters.to.slice(5, 7)) >= 7 ? "fall" : "spring"
              }
              statusLabels={RECURRING_STATUS_LABELS}
            />
            <MembershipActivityPanel
              key={`activity-${query}`}
              rows={data.activity}
            />
          </>
        )}
      </div>
    </DashboardShell>
  );
}
