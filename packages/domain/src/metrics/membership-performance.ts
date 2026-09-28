import { getPresetRange, type DatePreset } from "@irbis/utils";

export type MembershipPeriod = { from: string; to: string };
export type MembershipDepartment = "csr" | "hvac" | "plumbing" | "other";
export const MEMBERSHIP_DEPARTMENTS: Record<MembershipDepartment, string> = {
  csr: "CSR",
  hvac: "HVAC technicians",
  plumbing: "Plumbers",
  other: "Other / unassigned",
};
export type MembershipRepresentative = {
  id: string;
  name: string;
  department: MembershipDepartment;
  active: boolean;
  newSales: number;
  renewals: number;
  goal: number | null;
};
export type MembershipPerformance = {
  version: 1;
  period: MembershipPeriod;
  snapshotTime: string | null;
  state: "ready" | "partial" | "pending";
  sources: {
    summary: boolean;
    sales: boolean;
    renewals: boolean;
    recurring: boolean;
  };
  summary: {
    activeMembers: number | null;
    activeAtStart: number | null;
    newSales: number | null;
    renewals: number | null;
    cancellations: number | null;
    renewalRate: number | null;
    eligibleRenewals: number | null;
    renewedEligible: number | null;
    cancellationRate: number | null;
  };
  departments: Array<{
    id: MembershipDepartment;
    label: string;
    newSales: number;
    renewals: number;
  }>;
  representatives: MembershipRepresentative[];
  goals: {
    monthlyPerRep: number;
    perRep: number;
    representatives: number;
    total: number;
    achieved: number;
  };
  recurring: null | {
    total: number;
    booked: number;
    completed: number;
    outstanding: number;
    dismissed: number;
    byType: Array<{
      name: string;
      total: number;
      booked: number;
      outstanding: number;
      dismissed: number;
    }>;
  };
  membershipTypes: Array<{ name: string; active: number }>;
};

export function resolveMembershipPeriod(
  context: { preset?: DatePreset; from?: string; to?: string } = {},
  now = new Date(),
): MembershipPeriod {
  if (Boolean(context.from) !== Boolean(context.to))
    throw new Error("Both dates are required");
  const period =
    context.from && context.to
      ? { from: context.from, to: context.to }
      : getPresetRange(context.preset ?? "mtd", "America/Los_Angeles", now);
  for (const date of [period.from, period.to]) {
    const parsed = new Date(`${date}T12:00:00Z`);
    if (
      !/^20\d{2}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    )
      throw new Error("Invalid reporting date");
  }
  if (period.from > period.to)
    throw new Error("Start date must precede end date");
  if ((Date.parse(period.to) - Date.parse(period.from)) / 86_400_000 > 3660)
    throw new Error("Reporting range is too long");
  return period;
}

export const membershipScopeKey = ({ from, to }: MembershipPeriod) =>
  `membership-performance:v1:${from}:${to}`;
export function emptyMembershipPerformance(
  period: MembershipPeriod,
): MembershipPerformance {
  return {
    version: 1,
    period,
    snapshotTime: null,
    state: "pending",
    sources: {
      summary: false,
      sales: false,
      renewals: false,
      recurring: false,
    },
    summary: {
      activeMembers: null,
      activeAtStart: null,
      newSales: null,
      renewals: null,
      cancellations: null,
      renewalRate: null,
      eligibleRenewals: null,
      renewedEligible: null,
      cancellationRate: null,
    },
    departments: [],
    representatives: [],
    goals: {
      monthlyPerRep: 10,
      perRep: 10,
      representatives: 0,
      total: 0,
      achieved: 0,
    },
    recurring: null,
    membershipTypes: [],
  };
}

type Row = Record<string, unknown>;
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const identity = (value: unknown) =>
  text(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
// ServiceTitan membership term dates are date-only values encoded at UTC midnight.
const date = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : null;
const inside = (value: string | null, period: MembershipPeriod) =>
  value != null && value >= period.from && value <= period.to;
const count = (value: unknown) => {
  const n = value == null || value === "" ? 0 : Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid membership count");
  return n;
};

export function membershipRenewalCohort(
  memberships: Row[],
  details: Row[],
  period: MembershipPeriod,
) {
  const soldOn = new Map(
    details.map((row) => [String(row.CustomerMembershipId), date(row.SoldOn)]),
  );
  const byId = new Map(memberships.map((row) => [String(row.id), row]));
  let eligible = 0,
    renewed = 0;
  for (const row of byId.values()) {
    const expires = date(row.to);
    if (
      !inside(expires, period) ||
      row.status === "Deleted" ||
      row.active === false
    )
      continue;
    const canceled = date(row.cancellationDate);
    if (canceled && canceled <= expires!) continue;
    // A cancelled record without a date cannot establish an eligible cohort.
    if (row.status === "Canceled" && !canceled) return null;
    eligible++;
    if (row.renewedById == null) continue;
    const successor = byId.get(String(row.renewedById));
    if (!successor) return null;
    if (successor.status === "Deleted" || successor.active === false) continue;
    const sold = soldOn.get(String(successor.id));
    if (!sold) {
      // A future term omitted by the as-of report cannot yet be counted as renewed.
      if (date(successor.from)! > period.to) continue;
      return null;
    }
    if (sold <= period.to) renewed++;
  }
  return { eligible, renewed, rate: eligible ? renewed / eligible : null };
}

export function buildMembershipRecurring(
  rows: Row[],
  period: MembershipPeriod,
): NonNullable<MembershipPerformance["recurring"]> {
  const result: NonNullable<MembershipPerformance["recurring"]> = {
    total: 0,
    booked: 0,
    completed: 0,
    outstanding: 0,
    dismissed: 0,
    byType: [],
  };
  const seen = new Set<string>();
  const types = new Map<
    string,
    {
      name: string;
      total: number;
      booked: number;
      outstanding: number;
      dismissed: number;
    }
  >();
  for (const row of rows) {
    if (!inside(date(row.RecurringEventDate), period)) continue;
    const id = String(row.RecurringServiceEventId ?? "");
    if (!id) throw new Error("Recurring event ID missing");
    if (seen.has(id)) continue;
    seen.add(id);
    const name = text(row.RecurringServiceName) || "Other service";
    const type = types.get(name) ?? {
      name,
      total: 0,
      booked: 0,
      outstanding: 0,
      dismissed: 0,
    };
    const status = identity(row.Status);
    const booked = [
      "won",
      "scheduled",
      "in progress",
      "hold",
      "completed",
      "job scheduled",
      "job in progress",
      "job hold",
      "job completed",
    ].includes(status);
    const dismissed = status === "dismissed";
    if (
      !booked &&
      !dismissed &&
      ![
        "not attempted",
        "unreachable",
        "contacted",
        "cancelled",
        "canceled",
        "job cancelled",
        "job canceled",
      ].includes(status)
    )
      throw new Error("Unknown recurring event status");
    result.total++;
    type.total++;
    if (booked) {
      result.booked++;
      type.booked++;
    } else if (dismissed) {
      result.dismissed++;
      type.dismissed++;
    } else {
      result.outstanding++;
      type.outstanding++;
    }
    if (status === "job completed" || status === "completed")
      result.completed++;
    types.set(name, type);
  }
  result.byType = [...types.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  );
  return result;
}

export function buildMembershipPerformance(input: {
  period: MembershipPeriod;
  now: string;
  summaryRows: Row[] | null;
  salesRows: Row[] | null;
  recurringRows: Row[] | null;
  memberships: Row[] | null;
  membershipDetails: Row[] | null;
  employees: Row[];
  technicians: Row[];
  businessUnits: Row[];
  csrNames: string[];
  goalScope?: "service" | "csr" | "all-technicians";
  monthlyGoal?: number;
}): MembershipPerformance {
  const result = emptyMembershipPerformance(input.period);
  result.snapshotTime = input.now;
  result.goals.monthlyPerRep = input.monthlyGoal ?? 10;
  if (input.summaryRows) {
    const sum = (key: string) =>
      input.summaryRows!.reduce((sum, row) => sum + count(row[key]), 0);
    Object.assign(result.summary, {
      activeMembers: sum("ActiveAtEnd"),
      activeAtStart: sum("ActiveAtStart"),
      cancellations: sum("Canceled"),
    });
    result.summary.cancellationRate = result.summary.activeAtStart
      ? result.summary.cancellations! / result.summary.activeAtStart
      : null;
    result.membershipTypes = input.summaryRows
      .map((row) => ({ name: text(row.Name), active: count(row.ActiveAtEnd) }))
      .filter((row) => row.active > 0)
      .sort((a, b) => b.active - a.active);
    result.sources.summary = true;
  }
  if (input.memberships && input.membershipDetails) {
    const cohort = membershipRenewalCohort(
      input.memberships,
      input.membershipDetails,
      input.period,
    );
    if (cohort) {
      result.summary.eligibleRenewals = cohort.eligible;
      result.summary.renewedEligible = cohort.renewed;
      result.summary.renewalRate = cohort.rate;
      result.sources.renewals = true;
    }
  }
  if (input.recurringRows) {
    result.recurring = buildMembershipRecurring(
      input.recurringRows,
      input.period,
    );
    result.sources.recurring = true;
  }
  const months =
    (Number(input.period.to.slice(0, 4)) -
      Number(input.period.from.slice(0, 4))) *
      12 +
    Number(input.period.to.slice(5, 7)) -
    Number(input.period.from.slice(5, 7)) +
    1;
  result.goals.perRep = months * result.goals.monthlyPerRep;
  if (input.salesRows) {
    const bus = new Map(
      input.businessUnits.map((row) => [String(row.id), text(row.name)]),
    );
    const csrs = new Set(input.csrNames.map(identity));
    const reps = new Map<string, MembershipRepresentative>();
    for (const person of [...input.employees, ...input.technicians]) {
      const name = text(person.name),
        key = identity(name);
      const bu = bus.get(String(person.businessUnitId)) ?? "";
      const isTech = input.technicians.includes(person);
      const csr = !isTech && (person.role === "CSR" || csrs.has(key));
      const department: MembershipDepartment = csr
        ? "csr"
        : isTech && /HVAC/i.test(bu)
          ? "hvac"
          : isTech && /Plumb/i.test(bu)
            ? "plumbing"
            : "other";
      const active = person.active === true;
      const goal =
        active &&
        (csr ||
          (input.goalScope !== "csr" &&
            department !== "other" &&
            /Service|Maintenance/i.test(bu)) ||
          (input.goalScope === "all-technicians" &&
            /Install/i.test(bu) &&
            department !== "other"))
          ? result.goals.perRep
          : null;
      const previous = reps.get(key);
      if (
        !previous ||
        (department !== "other" && previous.department === "other")
      )
        reps.set(key, {
          id: String(person.id),
          name,
          department,
          active,
          newSales: 0,
          renewals: 0,
          goal,
        });
    }
    for (const row of input.salesRows) {
      if (!inside(date(row.SoldOn), input.period)) continue;
      const method = identity(row.ActivationMethod);
      if (!["new sale", "renewal"].includes(method))
        throw new Error("Unknown membership activation method");
      const name = text(row.SoldBy) || "Unassigned",
        key = identity(name);
      const rep = reps.get(key) ?? {
        id: `unmapped-${key}`,
        name,
        department: "other",
        active: false,
        newSales: 0,
        renewals: 0,
        goal: null,
      };
      if (method === "new sale") rep.newSales++;
      else rep.renewals++;
      reps.set(key, rep);
    }
    result.representatives = [...reps.values()]
      .filter((r) => r.goal != null || r.newSales || r.renewals)
      .sort(
        (a, b) =>
          b.newSales - a.newSales ||
          b.renewals - a.renewals ||
          a.name.localeCompare(b.name),
      );
    result.departments = (
      Object.entries(MEMBERSHIP_DEPARTMENTS) as [MembershipDepartment, string][]
    ).map(([id, label]) => ({
      id,
      label,
      newSales: result.representatives
        .filter((r) => r.department === id)
        .reduce((sum, r) => sum + r.newSales, 0),
      renewals: result.representatives
        .filter((r) => r.department === id)
        .reduce((sum, r) => sum + r.renewals, 0),
    }));
    const eligibleReps = result.representatives.filter((r) => r.goal != null);
    result.goals.representatives = eligibleReps.length;
    result.goals.total = eligibleReps.reduce((sum, r) => sum + r.goal!, 0);
    result.goals.achieved = eligibleReps.reduce(
      (sum, r) => sum + r.newSales,
      0,
    );
    result.sources.sales = true;
    result.summary.newSales = result.departments.reduce(
      (sum, d) => sum + d.newSales,
      0,
    );
    result.summary.renewals = result.departments.reduce(
      (sum, d) => sum + d.renewals,
      0,
    );
  }
  result.state = Object.values(result.sources).every(Boolean)
    ? "ready"
    : "partial";
  return result;
}
