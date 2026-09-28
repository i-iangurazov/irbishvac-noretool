import type { MembershipPeriod } from "./membership-performance";

type Row = Record<string, unknown>;
export type RecurringStatus =
  | "scheduled"
  | "completed"
  | "hold"
  | "inProgress"
  | "notAttempted"
  | "contacted"
  | "unreachable"
  | "cancelled"
  | "dismissed"
  | "won";
export const RECURRING_STATUS_LABELS: Record<RecurringStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  hold: "On hold",
  inProgress: "In progress",
  notAttempted: "Not attempted",
  contacted: "Contacted",
  unreachable: "Unreachable",
  cancelled: "Cancelled",
  dismissed: "Dismissed",
  won: "Booked",
};
export type MembershipServiceEvent = {
  id: string;
  date: string;
  name: string;
  status: RecurringStatus;
  customerId: string | null;
  customerName: string | null;
  membershipType: string;
  sourceNote: string | null;
};
export type MembershipRecurring = {
  period: MembershipPeriod;
  total: number;
  booked: number;
  completed: number;
  outstanding: number;
  dismissed: number;
  statuses: Record<RecurringStatus, number>;
  byType: Array<{
    name: string;
    total: number;
    booked: number;
    outstanding: number;
    dismissed: number;
  }>;
  events: MembershipServiceEvent[];
};
export type MembershipActivity = {
  id: string;
  membershipId: string;
  customerId: string | null;
  customerName: string | null;
  membershipType: string;
  previousStatus: string;
  status: string;
  changedAt: string;
  note: string | null;
};
export type MembershipServiceNote = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const day = (v: unknown) => str(v).slice(0, 10);
const inside = (d: string, p: MembershipPeriod) => d >= p.from && d <= p.to;
const id = (v: unknown) => (/^\d+$/.test(String(v ?? "")) ? String(v) : null);
const key = (v: unknown) =>
  str(v)
    .toLowerCase()
    .replace(/^job\s+/, "")
    .replace(/[\s_-]/g, "");
const statuses: Record<string, RecurringStatus> = {
  scheduled: "scheduled",
  completed: "completed",
  hold: "hold",
  inprogress: "inProgress",
  notattempted: "notAttempted",
  contacted: "contacted",
  unreachable: "unreachable",
  cancelled: "cancelled",
  canceled: "cancelled",
  dismissed: "dismissed",
  won: "won",
};

export function membershipSeasonPeriods(period: MembershipPeriod) {
  const year = period.to.slice(0, 4);
  return {
    spring: { from: `${year}-03-01`, to: `${year}-06-30` },
    fall: { from: `${year}-09-01`, to: `${year}-11-30` },
  };
}
export function membershipRecurringFetchPeriod(
  period: MembershipPeriod,
): MembershipPeriod {
  const seasons = membershipSeasonPeriods(period);
  return {
    from: period.from < seasons.spring.from ? period.from : seasons.spring.from,
    to: period.to > seasons.fall.to ? period.to : seasons.fall.to,
  };
}

export function buildRecurringServices(
  rows: Row[],
  period: MembershipPeriod,
  details: Row[] | null = null,
): MembershipRecurring {
  const result: MembershipRecurring = {
    period,
    total: 0,
    booked: 0,
    completed: 0,
    outstanding: 0,
    dismissed: 0,
    statuses: Object.fromEntries(
      Object.keys(RECURRING_STATUS_LABELS).map((k) => [k, 0]),
    ) as Record<RecurringStatus, number>,
    byType: [],
    events: [],
  };
  const byId = new Map(
    (details ?? []).map((row) => [String(row.RecurringServiceEventId), row]),
  );
  const types = new Map<string, MembershipRecurring["byType"][number]>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (!inside(day(row.RecurringEventDate), period)) continue;
    const eventId = id(row.RecurringServiceEventId);
    if (!eventId) throw new Error("Recurring event ID missing");
    if (seen.has(eventId)) continue;
    seen.add(eventId);
    const status = statuses[key(row.Status)];
    if (!status) throw new Error("Unknown recurring event status");
    const name = str(row.RecurringServiceName) || "Other service";
    const type = types.get(name) ?? {
      name,
      total: 0,
      booked: 0,
      outstanding: 0,
      dismissed: 0,
    };
    result.total++;
    type.total++;
    result.statuses[status]++;
    if (
      ["scheduled", "completed", "hold", "inProgress", "won"].includes(status)
    ) {
      result.booked++;
      type.booked++;
    } else if (status === "dismissed") {
      result.dismissed++;
      type.dismissed++;
    } else {
      result.outstanding++;
      type.outstanding++;
    }
    if (status === "completed") result.completed++;
    types.set(name, type);
    const detail = byId.get(eventId);
    result.events.push({
      id: eventId,
      date: day(row.RecurringEventDate),
      name,
      status,
      customerId: id(detail?.CustomerId),
      customerName: str(detail?.CustomerName) || null,
      membershipType: str(row.MembershipType),
      sourceNote: str(detail?.RecurringServiceMemo) || null,
    });
  }
  result.byType = [...types.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  );
  result.events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.customerName ?? "").localeCompare(b.customerName ?? "") ||
      a.id.localeCompare(b.id),
  );
  return result;
}

export function buildMembershipActivity(
  history: Row[],
  records: Row[],
  details: Row[],
  period: MembershipPeriod,
): MembershipActivity[] {
  const memberships = new Map(records.map((row) => [String(row.id), row]));
  const info = new Map(
    details.map((row) => [String(row.CustomerMembershipId), row]),
  );
  const seen = new Set<string>();
  const businessDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return history
    .flatMap((row) => {
      const changed = new Date(str(row.createdOn));
      if (!Number.isFinite(changed.getTime()))
        throw new Error("Invalid membership history date");
      if (
        !inside(businessDay.format(changed), period) ||
        !["Canceled", "Expired", "Deleted", "Suspended", "Active"].includes(
          str(row.newStatus),
        )
      )
        return [];
      const eventId = id(row.id),
        membershipId = id(row.membershipId);
      if (!eventId || !membershipId)
        throw new Error("Membership history ID missing");
      if (seen.has(eventId)) return [];
      seen.add(eventId);
      const record = memberships.get(membershipId),
        detail = info.get(membershipId);
      return [
        {
          id: eventId,
          membershipId,
          customerId: id(record?.customerId ?? detail?.CustomerId),
          customerName: str(detail?.CustomerName) || null,
          membershipType: str(detail?.MembershipType),
          previousStatus: str(row.oldStatus),
          status: str(row.newStatus),
          changedAt: changed.toISOString(),
          note: str(row.note) || null,
        },
      ];
    })
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}

export function membershipSalesValue(rows: Row[], period: MembershipPeriod) {
  let newSales = 0,
    renewals = 0;
  for (const row of rows) {
    if (!inside(day(row.SoldOn), period)) continue;
    if (
      row.MembershipPrice == null ||
      row.MembershipPrice === "" ||
      !Number.isFinite(Number(row.MembershipPrice))
    )
      return null;
    // Keep cents throughout; a legitimate credit remains a negative value.
    const cents = Math.round(Number(row.MembershipPrice) * 100);
    if (key(row.ActivationMethod) === "newsale") newSales += cents;
    else if (key(row.ActivationMethod) === "renewal") renewals += cents;
    else return null;
  }
  return {
    newSales: newSales / 100,
    renewals: renewals / 100,
    total: (newSales + renewals) / 100,
  };
}

export function memberJobRevenue(rows: Row[]) {
  const invoices = new Map<string, number>(),
    jobs = new Set<string>();
  for (const row of rows) {
    const invoice = str(row.InvoiceNumber),
      job = str(row.JobNumber),
      value = row.TotalRevenue;
    if (
      !invoice ||
      !job ||
      value == null ||
      value === "" ||
      !Number.isFinite(Number(value))
    )
      return null;
    const membershipCharges = row.MembershipCharges;
    if (
      membershipCharges == null ||
      !Number.isFinite(Number(membershipCharges))
    )
      return null;
    const cents =
      Math.round(Number(value) * 100) -
      Math.round(Number(membershipCharges) * 100);
    if (invoices.has(invoice) && invoices.get(invoice) !== cents) return null;
    invoices.set(invoice, cents);
    jobs.add(job);
  }
  return {
    total: [...invoices.values()].reduce((n, v) => n + v, 0) / 100,
    jobs: jobs.size,
  };
}
