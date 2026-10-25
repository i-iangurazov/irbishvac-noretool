import type {
  MembershipPerformance,
  MembershipPeriod,
} from "./membership-performance";

type Row = Record<string, unknown>;
export const MEMBERSHIP_CUSTOMER_METRICS = [
  "activeMembers",
  "newSales",
  "renewals",
  "cancellations",
  "expired",
] as const;
export type MembershipCustomerMetric =
  (typeof MEMBERSHIP_CUSTOMER_METRICS)[number];
export type MembershipCustomer = {
  key: string;
  membershipId: string;
  customerId: string | null;
  customerName: string;
  membershipType: string;
  date: string;
  termFrom: string | null;
  termTo: string | null;
  soldBy: string | null;
};
export type MembershipCustomerCohort = {
  state: "ready" | "unavailable";
  count: number | null;
  rows: MembershipCustomer[];
};
export type MembershipCustomerSnapshot = {
  version: 1;
  period: MembershipPeriod;
  snapshotTime: string;
  cohorts: Record<MembershipCustomerMetric, MembershipCustomerCohort>;
};
export type MembershipCustomerPage = {
  state: "ready" | "pending" | "unavailable";
  count: number | null;
  total: number;
  page: number;
  pageSize: number;
  rows: MembershipCustomer[];
};
export const membershipCustomerScopeKey = (period: MembershipPeriod) =>
  `membership-customers:v2:${period.from}:${period.to}`;
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const id = (value: unknown) =>
  /^\d{1,20}$/.test(String(value ?? "")) ? String(value) : null;
const date = (value: unknown) =>
  /^\d{4}-\d{2}-\d{2}/.test(text(value)) ? text(value).slice(0, 10) : null;
const localDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const eventDay = (value: unknown) => {
  const timestamp = new Date(text(value));
  return Number.isFinite(timestamp.getTime())
    ? localDate.format(timestamp)
    : null;
};
const inside = (value: string, period: MembershipPeriod) =>
  value >= period.from && value <= period.to;

/** Build the detail cohorts from the same refresh as their KPI totals. Never
 * publish an incomplete list as a full cohort: reconcile totals and plan mix.
 * No source records, payment fields or free-text memos enter this read model.
 */
export function buildMembershipCustomers(input: {
  dashboard: MembershipPerformance;
  summaryRows: Row[] | null;
  salesRows: Row[] | null;
  membershipRecords: Row[] | null;
  membershipDetails: Row[] | null;
  statusHistory: Row[] | null;
}): MembershipCustomerSnapshot {
  const {
    dashboard,
    summaryRows,
    salesRows,
    membershipRecords,
    membershipDetails,
    statusHistory,
  } = input;
  const period = dashboard.period;
  const cohorts = Object.fromEntries(
    MEMBERSHIP_CUSTOMER_METRICS.map((metric) => [
      metric,
      {
        state: "unavailable",
        count: dashboard.summary[metric],
        rows: [],
      },
    ]),
  ) as unknown as MembershipCustomerSnapshot["cohorts"];
  const result: MembershipCustomerSnapshot = {
    version: 1,
    period,
    snapshotTime: dashboard.snapshotTime!,
    cohorts,
  };
  const details = new Map(
    (membershipDetails ?? []).map((row) => [id(row.CustomerMembershipId), row]),
  );
  const records = new Map(
    (membershipRecords ?? []).map((row) => [id(row.id), row]),
  );
  function customer(
    membershipId: string,
    source: Row,
    relevantDate: string,
    key: string,
  ): MembershipCustomer | null {
    const detail = details.get(membershipId),
      record = records.get(membershipId);
    const customerName =
      text(source.CustomerName) || text(detail?.CustomerName);
    const membershipType =
      text(source.MembershipType) || text(detail?.MembershipType);
    if (!customerName || !membershipType) return null;
    return {
      key,
      membershipId,
      customerName,
      membershipType,
      customerId: id(detail?.CustomerId) ?? id(record?.customerId),
      date: relevantDate,
      termFrom: date(source.From) ?? date(record?.from),
      termTo: date(source.To) ?? date(record?.to),
      soldBy: text(source.SoldBy) || null,
    };
  }
  function publish(
    metric: MembershipCustomerMetric,
    candidates: Array<MembershipCustomer | null>,
    field?: string,
  ) {
    const rows = candidates.filter(
      (row): row is MembershipCustomer => row !== null,
    );
    if (
      rows.length !== candidates.length ||
      rows.length !== cohorts[metric].count
    )
      return;
    if (field) {
      const expected = new Map<string, number>(),
        actual = new Map<string, number>();
      for (const row of summaryRows ?? [])
        expected.set(
          text(row.Name),
          (expected.get(text(row.Name)) ?? 0) + Number(row[field] ?? 0),
        );
      for (const row of rows)
        actual.set(
          row.membershipType,
          (actual.get(row.membershipType) ?? 0) + 1,
        );
      if (
        [...new Set([...expected.keys(), ...actual.keys()])].some(
          (plan) => (expected.get(plan) ?? 0) !== (actual.get(plan) ?? 0),
        )
      )
        return;
    }
    rows.sort(
      (a, b) =>
        a.customerName.localeCompare(b.customerName, "en") ||
        a.membershipId.localeCompare(b.membershipId) ||
        a.key.localeCompare(b.key),
    );
    cohorts[metric] = { state: "ready", count: rows.length, rows };
  }
  if (salesRows) {
    for (const [metric, method] of [
      ["newSales", "new sale"],
      ["renewals", "renewal"],
    ] as const) {
      const sales = salesRows.filter(
        (row) =>
          text(row.ActivationMethod).toLowerCase() === method &&
          date(row.SoldOn) &&
          inside(date(row.SoldOn)!, period),
      );
      publish(
        metric,
        sales.map((row, index) => {
          const membershipId = id(row.CustomerMembershipId);
          return membershipId
            ? customer(
                membershipId,
                row,
                date(row.SoldOn)!,
                `${membershipId}:${index}`,
              )
            : null;
        }),
      );
    }
  }
  if (
    !membershipRecords ||
    !membershipDetails ||
    !statusHistory ||
    !summaryRows
  )
    return result;
  type Change = {
    timestamp: string;
    day: string;
    before: string;
    after: string;
    id: string;
  };
  const changes = new Map<string, Change[]>(),
    seen = new Set<string>();
  for (const row of statusHistory) {
    const membershipId = id(row.membershipId),
      eventId = id(row.id),
      day = eventDay(row.createdOn);
    if (!membershipId || !eventId || !day || !records.has(membershipId))
      return result;
    if (seen.has(eventId)) continue;
    seen.add(eventId);
    const list = changes.get(membershipId) ?? [];
    list.push({
      timestamp: text(row.createdOn),
      day,
      before: text(row.oldStatus),
      after: text(row.newStatus),
      id: eventId,
    });
    changes.set(membershipId, list);
  }
  for (const list of changes.values())
    list.sort(
      (a, b) =>
        a.timestamp.localeCompare(b.timestamp) ||
        a.id.localeCompare(b.id, "en", { numeric: true }),
    );
  const active: Array<MembershipCustomer | null> = [],
    canceled: Array<MembershipCustomer | null> = [],
    expired: Array<MembershipCustomer | null> = [];
  for (const row of membershipRecords) {
    const membershipId = id(row.id),
      created = eventDay(row.createdOn),
      from = date(row.from),
      to = date(row.to);
    if (!membershipId || !created || !from) return result;
    const list = changes.get(membershipId) ?? [];
    const prior = list.filter((change) => change.day <= period.to),
      later = list.filter((change) => change.day > period.to);
    const within = prior.filter((change) => change.day >= period.from);
    const beforeStart = list.filter((change) => change.day < period.from),
      afterStart = list.filter((change) => change.day >= period.from);
    const endStatus =
      prior.at(-1)?.after ?? later[0]?.before ?? text(row.status);
    const startStatus =
      beforeStart.at(-1)?.after ?? afterStart[0]?.before ?? text(row.status);
    // Term dates are business dates (not UTC timestamps). Future-start plans
    // and plans whose term already ended do not contribute to the balance.
    const activeAtStart =
      startStatus === "Active" &&
      created < period.from &&
      from <= period.from &&
      (!to || to >= period.from);
    if (
      endStatus === "Active" &&
      created <= period.to &&
      from <= period.to &&
      (!to || to >= period.to)
    )
      active.push(customer(membershipId, row, period.to, membershipId));
    // Summary tracks departures from the active balance. A plan suspended
    // before this period and then canceled is not another active cancellation.
    const entered =
      activeAtStart ||
      (inside(created, period) && from <= period.to) ||
      within.some((change) => change.after === "Active");
    const last = within.at(-1);
    if (entered && last && ["Canceled", "Expired"].includes(last.after)) {
      const target = last.after === "Canceled" ? canceled : expired;
      target.push(customer(membershipId, row, last.day, membershipId));
    }
  }
  publish("activeMembers", active, "ActiveAtEnd");
  publish("cancellations", canceled, "Canceled");
  publish("expired", expired, "Expired");
  return result;
}
