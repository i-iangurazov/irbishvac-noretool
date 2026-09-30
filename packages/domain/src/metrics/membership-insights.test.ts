import { describe, expect, it } from "vitest";
import {
  buildMembershipPerformance,
  resolveMembershipPeriod,
} from "./membership-performance";
import {
  buildMembershipActivity,
  buildRecurringServices,
  memberJobRevenue,
  membershipRecurringFetchPeriod,
  membershipSalesValue,
  membershipSeasonPeriods,
} from "./membership-insights";
const period = { from: "2026-09-01", to: "2026-09-28" };
describe("membership meeting metrics", () => {
  it("uses exact one-day balances and keeps expired separate from cancelled", () => {
    const point = resolveMembershipPeriod({
      from: "2026-09-14",
      to: "2026-09-14",
    });
    const data = buildMembershipPerformance({
      period: point,
      now: "2026-09-28T20:00:00Z",
      summaryRows: [
        {
          Name: "Plan",
          ActiveAtStart: 800,
          ActiveAtEnd: 802,
          Canceled: 2,
          Expired: 3,
        },
      ],
      salesRows: [],
      recurringRows: [],
      memberships: [],
      membershipDetails: [],
      employees: [],
      technicians: [],
      businessUnits: [],
      csrNames: [],
    });
    expect(data.period).toEqual(point);
    expect(data.summary).toMatchObject({
      activeMembers: 802,
      cancellations: 2,
      expired: 3,
    });
    // No env override: the renewal target falls back to the approved
    // conversion plan (September drives toward the 60% Q4 milestone). The
    // cancellation limit stays unset because the document does not define one.
    expect(data.thresholds).toEqual({
      renewalTarget: 0.6,
      cancellationLimit: null,
    });
    expect(
      buildMembershipPerformance({
        period: point,
        now: "2026-09-28T20:00:00Z",
        summaryRows: [],
        salesRows: [],
        recurringRows: [],
        memberships: [],
        membershipDetails: [],
        employees: [],
        technicians: [],
        businessUnits: [],
        csrNames: [],
        renewalTarget: 0.35,
        cancellationLimit: 0.1,
      }).thresholds,
    ).toEqual({ renewalTarget: 0.35, cancellationLimit: 0.1 });
  });
  it("includes October fall maintenance in a September board without changing September totals", () => {
    const row = {
      RecurringServiceEventId: 1,
      RecurringEventDate: "2026-10-01",
      RecurringServiceName: "Heating",
      Status: "Hold",
    };
    const seasons = membershipSeasonPeriods(period);
    expect(buildRecurringServices([row], period).total).toBe(0);
    const fall = buildRecurringServices([row], seasons.fall, [
      {
        RecurringServiceEventId: 1,
        CustomerId: 42,
        CustomerName: "Example",
        RecurringServiceMemo: "Customer asked to reschedule",
      },
    ]);
    expect(fall).toMatchObject({ total: 1, booked: 1, statuses: { hold: 1 } });
    expect(fall.events[0]).toMatchObject({
      customerId: "42",
      customerName: "Example",
      sourceNote: "Customer asked to reschedule",
    });
    expect(membershipRecurringFetchPeriod(period)).toEqual({
      from: "2026-03-01",
      to: "2026-11-30",
    });
    expect(
      membershipRecurringFetchPeriod({ from: "2025-12-01", to: "2026-12-15" }),
    ).toEqual({ from: "2025-12-01", to: "2026-12-15" });
  });
  it("keeps all recurring statuses mutually exclusive while preserving booking and outstanding totals", () => {
    const labels = [
      "Completed",
      "Scheduled",
      "In Progress",
      "Hold",
      "Not Attempted",
      "Contacted",
      "Unreachable",
      "Canceled",
      "Dismissed",
      "Won",
    ];
    const data = buildRecurringServices(
      labels.map((Status, i) => ({
        RecurringServiceEventId: i + 1,
        RecurringEventDate: period.from,
        Status,
      })),
      period,
    );
    expect(Object.values(data.statuses).reduce((n, v) => n + v, 0)).toBe(10);
    expect(data).toMatchObject({
      total: 10,
      booked: 5,
      completed: 1,
      outstanding: 4,
      dismissed: 1,
    });
  });
  it("preserves source reasons and local reporting dates without calling deletions estimate withdrawals", () => {
    const rows = [
      {
        id: 1,
        membershipId: 7,
        createdOn: "2026-09-01T05:00:00Z",
        oldStatus: "Active",
        newStatus: "Canceled",
      },
      {
        id: 2,
        membershipId: 7,
        createdOn: "2026-09-02T05:00:00Z",
        oldStatus: "Active",
        newStatus: "Deleted",
        note: null,
      },
    ];
    const result = buildMembershipActivity(
      rows,
      [{ id: 7, customerId: 4 }],
      [
        {
          CustomerMembershipId: 7,
          CustomerName: "Example",
          MembershipType: "Annual",
        },
      ],
      period,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      status: "Deleted",
      note: null,
      customerId: "4",
    });
    expect(result[0]).not.toHaveProperty("estimateWithdrawn");
  });
  it("excludes membership invoice items, deduplicates invoices and preserves credit adjustments", () => {
    const rows = [
      {
        InvoiceNumber: "1",
        JobNumber: "A",
        TotalRevenue: 1500,
        MembershipCharges: 299,
      },
      {
        InvoiceNumber: "1",
        JobNumber: "A",
        TotalRevenue: 1500,
        MembershipCharges: 299,
      },
      {
        InvoiceNumber: "2",
        JobNumber: "A",
        TotalRevenue: -100,
        MembershipCharges: 0,
      },
    ];
    expect(memberJobRevenue(rows)).toEqual({ total: 1101, jobs: 1 });
    expect(
      memberJobRevenue([
        { InvoiceNumber: "1", JobNumber: "A", TotalRevenue: 1500 },
      ]),
    ).toBeNull();
    expect(
      memberJobRevenue([
        ...rows,
        {
          InvoiceNumber: "1",
          JobNumber: "A",
          TotalRevenue: 1600,
          MembershipCharges: 299,
        },
      ]),
    ).toBeNull();
  });
  it("does not turn missing sales prices into zero or include sales outside the period", () => {
    expect(
      membershipSalesValue(
        [
          {
            SoldOn: period.from,
            ActivationMethod: "New Sale",
            MembershipPrice: 99.99,
          },
          {
            SoldOn: period.to,
            ActivationMethod: "Renewal",
            MembershipPrice: 200.01,
          },
          {
            SoldOn: "2026-10-01",
            ActivationMethod: "New Sale",
            MembershipPrice: 10,
          },
        ],
        period,
      ),
    ).toEqual({ newSales: 99.99, renewals: 200.01, total: 300 });
    expect(
      membershipSalesValue(
        [{ SoldOn: period.from, ActivationMethod: "New Sale" }],
        period,
      ),
    ).toBeNull();
  });
  it("separates HVAC service and maintenance and keeps installation/advisors out of their goals", () => {
    const data = buildMembershipPerformance({
      period,
      now: "2026-09-28T20:00:00Z",
      summaryRows: [],
      salesRows: [],
      recurringRows: [],
      memberships: [],
      membershipDetails: [],
      employees: [],
      technicians: [
        { id: 1, name: "HVAC service", businessUnitId: 1, active: true },
        { id: 2, name: "HVAC maintenance", businessUnitId: 2, active: true },
        { id: 3, name: "Installer", businessUnitId: 3, active: true },
      ],
      businessUnits: [
        { id: 1, name: "HVAC - Service" },
        { id: 2, name: "HVAC - Maintenance" },
        { id: 3, name: "HVAC - Install" },
      ],
      csrNames: [],
    });
    expect(data.representatives.map((r) => r.department).sort()).toEqual([
      "hvac",
      "hvac-maintenance",
    ]);
    expect(data.goals.total).toBe(20);
  });
});

it("uses customer type, not plan names, for market segmentation", () => {
  const data = buildMembershipPerformance({
    period,
    now: "2026-09-28T20:00:00Z",
    summaryRows: [],
    salesRows: [
      {
        SoldOn: period.from,
        ActivationMethod: "New Sale",
        SoldBy: "CSR",
        CustomerType: "Commercial",
        MembershipType: "Annual",
      },
      {
        SoldOn: period.from,
        ActivationMethod: "Renewal",
        SoldBy: "CSR",
        CustomerType: "Residential",
        MembershipType: "Annual",
      },
    ],
    recurringRows: [],
    memberships: [],
    membershipDetails: [],
    employees: [],
    technicians: [],
    businessUnits: [],
    csrNames: [],
  });
  expect(data.salesByMarket).toEqual({
    residential: 0,
    commercial: 1,
    other: 0,
  });
});
