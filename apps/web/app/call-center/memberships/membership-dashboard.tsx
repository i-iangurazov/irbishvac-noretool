import type { CSSProperties, ReactNode } from "react";
import type {
  MembershipComparison,
  MembershipPerformance,
  MembershipRateSnapshot,
} from "@irbis/domain";
import {
  MEMBERSHIP_CHANNEL_PLAN,
  MEMBERSHIP_COMPANY_GOAL,
  MEMBERSHIP_DEPARTMENT_GOALS,
  MEMBERSHIP_DEPARTMENT_TOTAL_GOAL,
  MEMBERSHIP_DEPARTMENTS,
  MEMBERSHIP_RENEWAL_MILESTONES,
  MEMBERSHIP_TECH_TIERS,
  MEMBERSHIP_TOTAL_MONTHLY_GOAL,
  RECURRING_STATUS_LABELS,
  membershipGoalStatus,
  membershipRenewalTarget,
} from "@irbis/domain";
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

type ComparisonRow = {
  label: string;
  hint: string;
  format: (value: number | null) => string;
  current: number | null;
  read: (snapshot: MembershipRateSnapshot | null) => number | null;
  change: (current: number, previous: number) => string;
  /** Whether a higher value is good, bad or neutral for this metric. */
  direction: "up" | "down" | "neutral";
};
const pointDelta = (current: number, previous: number) =>
  `${current - previous >= 0 ? "+" : ""}${((current - previous) * 100).toFixed(1)} pt`;
const countDelta = (current: number, previous: number) => {
  const diff = current - previous;
  return `${diff >= 0 ? "+" : ""}${diff.toLocaleString("en-US")}`;
};

/**
 * Renewal, cancellation and new-sales rates plus the underlying volumes, each
 * compared against the previous month, previous quarter and the same period a
 * year earlier.
 */
function MembershipComparisonPanel({
  comparison,
  summary,
}: {
  comparison: MembershipComparison[];
  summary: MembershipPerformance["summary"];
}) {
  if (!comparison.length) return null;
  const rows: ComparisonRow[] = [
    {
      label: "Renewal rate",
      hint: "Nondeleted fixed-term memberships expiring in the period that were renewed.",
      format: rate,
      current: summary.renewalRate,
      read: (snapshot) => snapshot?.renewalRate ?? null,
      change: pointDelta,
      direction: "up",
    },
    {
      label: "Cancellation rate",
      hint: "Cancellations in the period divided by memberships active at its start.",
      format: rate,
      current: summary.cancellationRate,
      read: (snapshot) => snapshot?.cancellationRate ?? null,
      change: pointDelta,
      direction: "down",
    },
    {
      label: "New sales rate",
      hint: "New memberships sold as a share of the membership base at period start.",
      format: rate,
      current: summary.newSalesRate,
      read: (snapshot) => snapshot?.newSalesRate ?? null,
      change: pointDelta,
      direction: "up",
    },
    {
      label: "New sales",
      hint: "New Sale memberships sold in the period.",
      format: num,
      current: summary.newSales,
      read: (snapshot) => snapshot?.newSales ?? null,
      change: countDelta,
      direction: "up",
    },
    {
      label: "Renewals",
      hint: "Renewal memberships sold in the period.",
      format: num,
      current: summary.renewals,
      read: (snapshot) => snapshot?.renewals ?? null,
      change: countDelta,
      direction: "up",
    },
    {
      label: "Cancellations",
      hint: "Memberships cancelled during the period.",
      format: num,
      current: summary.cancellations,
      read: (snapshot) => snapshot?.cancellations ?? null,
      change: countDelta,
      direction: "down",
    },
    {
      label: "Active members",
      hint: "Membership balance at the end of the period.",
      format: num,
      current: summary.activeMembers,
      read: (snapshot) => snapshot?.activeMembers ?? null,
      change: countDelta,
      direction: "up",
    },
  ];
  return (
    <section className="csr-panel membership-comparison">
      <div className="membership-panel-heading">
        <h2>Period comparison</h2>
        <Hint>
          Month over month uses the previous calendar month, quarter over
          quarter the previous calendar quarter, and year over year the same
          dates one year earlier. A dash means that source was unavailable for
          the compared period; it is never a zero.
        </Hint>
      </div>
      <div
        className="membership-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Membership rate comparison by period"
      >
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>This period</th>
              {comparison.map((entry) => (
                <th key={entry.kind}>{entry.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>
                  {row.label}
                  <Hint>{row.hint}</Hint>
                </td>
                <td className="membership-comparison__current">
                  {row.format(row.current)}
                </td>
                {comparison.map((entry) => {
                  const value = row.read(entry.snapshot);
                  const changed =
                    value != null && row.current != null
                      ? row.current - value
                      : null;
                  const tone =
                    changed == null || changed === 0 || row.direction === "neutral"
                      ? "flat"
                      : (changed > 0) === (row.direction === "up")
                        ? "better"
                        : "worse";
                  return (
                    <td key={entry.kind}>
                      <span className="membership-comparison__value">
                        {row.format(value)}
                      </span>
                      {changed != null && (
                        <span
                          className={`membership-comparison__delta membership-comparison__delta--${tone}`}
                        >
                          {row.change(row.current!, value!)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const GOAL_TONES: Record<string, string> = {
  met: "met",
  "on-track": "on-track",
  behind: "behind",
  unknown: "unknown",
};
const GOAL_LABELS: Record<string, string> = {
  met: "On goal",
  "on-track": "On track",
  behind: "Behind",
  unknown: "No data",
};

/**
 * The IRBIS Membership Conversion Goals plan: the company target, the
 * per-channel monthly goals and the field tiers, measured against the current
 * period's actuals where the source data supports it.
 */
function MembershipConversionGoals({
  summary,
  departments,
  periodTo,
}: {
  summary: MembershipPerformance["summary"];
  departments: MembershipPerformance["departments"];
  periodTo: string;
}) {
  const goal = MEMBERSHIP_COMPANY_GOAL;
  const active = summary.activeMembers;
  const target = new Date(`${goal.targetDate}T12:00:00Z`);
  const end = new Date(`${periodTo}T12:00:00Z`);
  const monthsRemaining = Math.max(
    1,
    (target.getUTCFullYear() - end.getUTCFullYear()) * 12 +
      (target.getUTCMonth() - end.getUTCMonth()),
  );
  const gap = active == null ? null : Math.max(0, goal.targetMembers - active);
  const required = gap == null ? null : Math.ceil(gap / monthsRemaining);
  const progress =
    active == null ? 0 : Math.min(1, active / goal.targetMembers);
  const renewal = membershipRenewalTarget(periodTo);
  const actual = (department: string) =>
    departments.find((entry) => entry.id === department)?.newSales ?? null;
  return (
    <section className="csr-panel membership-goals">
      <div className="membership-panel-heading">
        <h2>Conversion goals</h2>
        <Hint>
          Targets from the IRBIS Membership Conversion Goals plan (July–December
          2026) shared by membership leadership. Monthly ranges are department
          totals, not per person.
        </Hint>
      </div>
      <div className="membership-company-goal">
        <div className="membership-company-goal__headline">
          <div>
            <strong>{num(active)}</strong>
            <span> / {goal.targetMembers.toLocaleString("en-US")} members</span>
            <small>
              Company goal · {goal.targetDate} ({monthsRemaining}{" "}
              {monthsRemaining === 1 ? "month" : "months"} left)
            </small>
          </div>
          <div className="membership-company-goal__gap">
            <b>
              {required == null
                ? "—"
                : `${required.toLocaleString("en-US")} / month`}
            </b>
            <small>
              Net gain needed · plan requires ~
              {goal.planMonthlyNetRequired}/month
            </small>
          </div>
        </div>
        <div
          className="membership-track"
          role="progressbar"
          aria-label="Progress toward the 1,000-member company goal"
          aria-valuemin={0}
          aria-valuemax={goal.targetMembers}
          aria-valuenow={active ?? 0}
          aria-valuetext={`${active ?? 0} of ${goal.targetMembers} members`}
        >
          <i style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="membership-goals__requirement">
          At current renewal rates the plan needs ~
          {goal.newSalesRequiredCurrentRenewal} new sales/month to reach 1,000;
          once renewals reach 60% that drops to ~
          {goal.newSalesRequiredSixtyPercentRenewal}.
        </p>
      </div>
      <div
        className="membership-table-wrap membership-goals__table"
        tabIndex={0}
        role="region"
        aria-label="Monthly new-sales goals by channel"
      >
        <table>
          <thead>
            <tr>
              <th>Channel</th>
              <th>Goal / month</th>
              <th>This period</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {MEMBERSHIP_DEPARTMENT_GOALS.map((entry) => {
              const value = actual(entry.department);
              const status = membershipGoalStatus(value, entry.monthly);
              return (
                <tr key={entry.department}>
                  <td>
                    <b>{entry.label}</b>
                    <span className="membership-goals__conversion">
                      {entry.conversion}
                      {entry.opportunities
                        ? ` · ${entry.opportunities[0]}–${entry.opportunities[1]} opportunities/mo`
                        : ""}
                    </span>
                  </td>
                  <td>
                    {entry.monthly[0]}–{entry.monthly[1]}
                  </td>
                  <td className="membership-comparison__current">
                    {num(value)}
                  </td>
                  <td>
                    <span
                      className={`membership-goal-badge membership-goal-badge--${GOAL_TONES[status]}`}
                    >
                      {GOAL_LABELS[status]}
                    </span>
                  </td>
                </tr>
              );
            })}
            <tr className="membership-goals__total">
              <td>
                <b>All channels</b>
                <span className="membership-goals__conversion">
                  Departments {MEMBERSHIP_DEPARTMENT_TOTAL_GOAL[0]}–
                  {MEMBERSHIP_DEPARTMENT_TOTAL_GOAL[1]} plus CSR and cold
                  outreach
                </span>
              </td>
              <td>
                {MEMBERSHIP_TOTAL_MONTHLY_GOAL[0]}–
                {MEMBERSHIP_TOTAL_MONTHLY_GOAL[1]}
              </td>
              <td className="membership-comparison__current">
                {num(summary.newSales)}
              </td>
              <td>
                <span
                  className={`membership-goal-badge membership-goal-badge--${GOAL_TONES[membershipGoalStatus(summary.newSales, MEMBERSHIP_TOTAL_MONTHLY_GOAL)]}`}
                >
                  {GOAL_LABELS[membershipGoalStatus(summary.newSales, MEMBERSHIP_TOTAL_MONTHLY_GOAL)]}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="membership-goals__footer">
        <div>
          <h3>Renewal milestones</h3>
          <ul>
            {MEMBERSHIP_RENEWAL_MILESTONES.map((milestone) => (
              <li key={milestone.date}>
                <b>{(milestone.rate * 100).toFixed(0)}%</b>
                <span>{milestone.label}</span>
              </li>
            ))}
          </ul>
          <p>
            Driving toward {renewal.label}
            {renewal.previous
              ? ` · previous milestone ${renewal.previous.label}`
              : ""}
          </p>
        </div>
        <div>
          <h3>Field tiers (per tech / month)</h3>
          <ul>
            {MEMBERSHIP_TECH_TIERS.map((tier) => (
              <li key={tier.tier}>
                <b>
                  {tier.perTech[0]}–{tier.perTech[1]}
                </b>
                <span>
                  {tier.tier} · {tier.opportunityPct}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Channel plan</h3>
          <ul>
            {MEMBERSHIP_CHANNEL_PLAN.map((channel) => (
              <li key={channel.channel}>
                <b>{channel.proposed}</b>
                <span>{channel.channel}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
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
  // Older snapshots predate the comparison panel; never crash on a missing key.
  const comparison = data.comparison ?? [];
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
            <div className="membership-rate-grid">
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
                hint={`Fixed-term memberships expiring in the selected period, excluding deleted records and cancellations before expiration. Rate = those linked to a renewal sold by period end / eligible memberships. Ongoing monthly plans are excluded. Target: ${membershipRenewalTarget(filters.to).label}.`}
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
              <Health
                title="New sales rate"
                value={s.newSalesRate}
                detail={
                  s.newSales == null || s.activeAtStart == null
                    ? s.newSales == null
                      ? "Sales data unavailable"
                      : "Starting balance unavailable"
                    : `${num(s.newSales)} new sales on ${num(s.activeAtStart)} members at period start`
                }
                hint="New Sale memberships sold during the selected period as a share of the membership balance at the start of that period. It is a growth-intensity rate, not a conversion percentage against opportunities."
              />
            </div>
            <div className="membership-revenue-grid">
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
            <MembershipComparisonPanel
              comparison={comparison}
              summary={s}
            />
            <MembershipConversionGoals
              summary={s}
              departments={data.departments}
              periodTo={data.period.to}
            />
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
