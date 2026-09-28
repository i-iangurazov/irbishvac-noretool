import { describe, expect, it } from "vitest";
import {
  buildMembershipPerformance,
  buildMembershipRecurring,
  emptyMembershipPerformance,
  membershipRenewalCohort,
  membershipScopeKey,
  resolveMembershipPeriod,
} from "./membership-performance";
const period = { from: "2026-09-01", to: "2026-09-30" };
const base = () => ({
  period,
  now: "2026-09-28T16:00:00Z",
  summaryRows: [
    {
      Name: "Annual",
      ActiveAtStart: 100,
      ActiveAtEnd: 110,
      Canceled: 5,
      NewSales: 90,
      Renewed: 30,
    },
  ],
  salesRows: [] as Record<string, unknown>[],
  recurringRows: [],
  memberships: [],
  membershipDetails: [],
  employees: [
    { id: 1, name: "CSR One", active: true, role: "CSR" },
    { id: 2, name: "Inactive CSR", active: false, role: "CSR" },
  ],
  technicians: [
    { id: 3, name: "Service Tech", active: true, businessUnitId: 10 },
    { id: 4, name: "Install Tech", active: true, businessUnitId: 11 },
    { id: 5, name: "Plumber", active: true, businessUnitId: 12 },
  ],
  businessUnits: [
    { id: 10, name: "HVAC - Service" },
    { id: 11, name: "HVAC - Install" },
    { id: 12, name: "Plumbing - Service" },
  ],
  csrNames: [],
});
describe("membership performance", () => {
  it("separates new sales from renewals and reconciles representatives, departments and headline", () => {
    const input = base();
    input.salesRows = [
      {
        SoldOn: "2026-09-01T00:00:00-07:00",
        SoldBy: "CSR One",
        ActivationMethod: "New Sale",
      },
      {
        SoldOn: "2026-09-30T00:00:00-07:00",
        SoldBy: "CSR One",
        ActivationMethod: "Renewal",
      },
      {
        SoldOn: "2026-09-04",
        SoldBy: "Service Tech",
        ActivationMethod: "New Sale",
      },
      {
        SoldOn: "2026-09-04",
        SoldBy: "Unknown Person",
        ActivationMethod: "New Sale",
      },
      { SoldOn: "2026-08-31", SoldBy: "CSR One", ActivationMethod: "New Sale" },
    ];
    const data = buildMembershipPerformance(input);
    expect(data.summary).toMatchObject({
      newSales: 3,
      renewals: 1,
      activeMembers: 110,
      cancellationRate: 0.05,
    });
    expect(data.departments.reduce((n, d) => n + d.newSales, 0)).toBe(3);
    expect(data.departments.find((d) => d.id === "other")?.newSales).toBe(1);
    expect(
      data.representatives.find((r) => r.name === "CSR One"),
    ).toMatchObject({ newSales: 1, renewals: 1, goal: 10 });
  });
  it("applies goals to all current CSR and service representatives, including zero sellers, excluding install and inactive", () => {
    const data = buildMembershipPerformance(base());
    expect(data.goals).toMatchObject({
      representatives: 3,
      monthlyPerRep: 10,
      perRep: 10,
      total: 30,
      achieved: 0,
    });
    expect(data.representatives.map((r) => r.name)).toEqual([
      "CSR One",
      "Plumber",
      "Service Tech",
    ]);
    const ytd = buildMembershipPerformance({
      ...base(),
      period: { from: "2026-01-01", to: "2026-09-28" },
    });
    expect(ytd.goals.perRep).toBe(90);
  });
  it("uses the expiration cohort and excludes renewals sold after the reporting cutoff", () => {
    const records = [
      {
        id: 1,
        to: "2026-09-01T00:00:00Z",
        status: "Expired",
        active: true,
        renewedById: 2,
      },
      {
        id: 2,
        from: "2026-09-02",
        to: "2027-09-01",
        status: "Active",
        active: true,
      },
      {
        id: 3,
        to: "2026-09-30",
        status: "Expired",
        active: true,
        renewedById: 4,
      },
      {
        id: 4,
        from: "2026-10-01",
        to: "2027-09-30",
        status: "Active",
        active: true,
      },
      { id: 5, to: null, status: "Active", active: true },
      {
        id: 6,
        to: "2026-09-20",
        status: "Canceled",
        active: true,
        cancellationDate: "2026-09-10",
      },
      { id: 7, to: "2026-09-20", status: "Deleted", active: false },
    ];
    expect(
      membershipRenewalCohort(
        records,
        [
          { CustomerMembershipId: 2, SoldOn: "2026-08-29" },
          { CustomerMembershipId: 4, SoldOn: "2026-10-01" },
        ],
        period,
      ),
    ).toEqual({ eligible: 2, renewed: 1, rate: 0.5 });
  });
  it("never invents a renewal rate for incomplete linkage or a zero cohort", () => {
    expect(
      membershipRenewalCohort(
        [{ id: 1, to: "2026-09-02", renewedById: 999 }],
        [],
        period,
      ),
    ).toBeNull();
    expect(membershipRenewalCohort([], [], period)).toEqual({
      eligible: 0,
      renewed: 0,
      rate: null,
    });
  });
  it("counts every recurring event once and returns canceled jobs to outstanding", () => {
    const row = (id: number, Status: string) => ({
      RecurringServiceEventId: id,
      RecurringEventDate: "2026-09-01",
      RecurringServiceName: "AC",
      Status,
    });
    const data = buildMembershipRecurring(
      [
        row(1, "Completed"),
        row(1, "Completed"),
        row(2, "Scheduled"),
        row(3, "Canceled"),
        row(4, "Dismissed"),
        row(5, "Not Attempted"),
      ],
      period,
    );
    expect(data).toMatchObject({
      total: 5,
      booked: 2,
      completed: 1,
      outstanding: 2,
      dismissed: 1,
    });
    expect(data.booked + data.outstanding + data.dismissed).toBe(data.total);
    expect(() =>
      buildMembershipRecurring([row(6, "New unknown state")], period),
    ).toThrow();
  });
  it("keeps unavailable sources distinct from valid empty results", () => {
    const missing = buildMembershipPerformance({
      ...base(),
      summaryRows: null,
      salesRows: null,
      recurringRows: null,
      memberships: null,
    });
    expect(missing.state).toBe("partial");
    expect(missing.summary.newSales).toBeNull();
    expect(missing.summary.activeMembers).toBeNull();
    expect(missing.recurring).toBeNull();
    const empty = buildMembershipPerformance(base());
    expect(empty.summary.newSales).toBe(0);
    expect(empty.recurring?.total).toBe(0);
    expect(empty.summary.renewalRate).toBeNull();
    expect(emptyMembershipPerformance(period).snapshotTime).toBeNull();
  });
  it("validates real dates, complete ranges and exact period keys", () => {
    expect(() =>
      resolveMembershipPeriod({ from: "2026-02-30", to: "2026-03-01" }),
    ).toThrow();
    expect(() => resolveMembershipPeriod({ from: "2026-09-01" })).toThrow();
    expect(() =>
      resolveMembershipPeriod({ from: "2026-09-30", to: "2026-09-01" }),
    ).toThrow();
    expect(
      resolveMembershipPeriod(
        { preset: "mtd" },
        new Date("2026-10-01T05:00:00Z"),
      ),
    ).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(membershipScopeKey(period)).not.toBe(
      membershipScopeKey({ from: "2026-01-01", to: period.to }),
    );
  });
});
