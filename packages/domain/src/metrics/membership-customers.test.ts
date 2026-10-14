import { describe, expect, it } from "vitest";
import { buildMembershipCustomers } from "./membership-customers";
import { emptyMembershipPerformance } from "./membership-performance";
const period = { from: "2026-09-01", to: "2026-09-30" };
const member = (id: number, status = "Active", extra = {}) => ({
  id,
  customerId: id + 100,
  status,
  createdOn: "2026-01-01T12:00:00Z",
  from: "2026-01-01",
  to: "2026-12-31",
  ...extra,
});
const detail = (id: number, extra = {}) => ({
  CustomerMembershipId: id,
  CustomerName: `Customer ${id}`,
  MembershipType: "Annual",
  ...extra,
});
const change = (
  id: number,
  membershipId: number,
  createdOn: string,
  oldStatus: string,
  newStatus: string,
) => ({ id, membershipId, createdOn, oldStatus, newStatus });
function input() {
  const dashboard = emptyMembershipPerformance(period);
  dashboard.snapshotTime = "2026-10-14T12:00:00.000Z";
  Object.assign(dashboard.summary, {
    activeMembers: 2,
    newSales: 0,
    renewals: 0,
    cancellations: 1,
    expired: 1,
  });
  return {
    dashboard,
    summaryRows: [{ Name: "Annual", ActiveAtEnd: 2, Canceled: 1, Expired: 1 }],
    salesRows: [] as Record<string, unknown>[],
    membershipRecords: [
      member(1, "Canceled"),
      member(2, "Active", { from: "2026-10-01" }),
      member(3, "Expired", { to: "2026-08-31" }),
      member(4, "Canceled"),
      member(5, "Canceled"),
      member(6, "Expired", { to: "2026-09-12" }),
      member(7),
      member(8, "Active", { createdOn: "2026-10-02T12:00:00Z" }),
    ],
    membershipDetails: Array.from({ length: 8 }, (_, i) => detail(i + 1)),
    statusHistory: [
      change(1, 1, "2026-10-05T12:00:00Z", "Active", "Canceled"),
      change(2, 3, "2026-09-01T07:39:00Z", "Active", "Expired"),
      change(3, 4, "2026-09-12T12:00:00Z", "Active", "Canceled"),
      change(4, 5, "2026-08-25T12:00:00Z", "Active", "Suspended"),
      change(5, 5, "2026-09-12T12:00:00Z", "Suspended", "Canceled"),
      change(6, 6, "2026-09-13T07:39:00Z", "Active", "Expired"),
      change(7, 7, "2026-09-05T12:00:00Z", "Active", "Canceled"),
      change(8, 7, "2026-09-07T12:00:00Z", "Canceled", "Active"),
    ],
  };
}
describe("membership customer cohorts", () => {
  it("reconstructs the historical active balance and the last departures within a period", () => {
    const result = buildMembershipCustomers(input());
    expect(
      result.cohorts.activeMembers.rows.map((row) => row.membershipId),
    ).toEqual(["1", "7"]);
    expect(
      result.cohorts.cancellations.rows.map((row) => row.membershipId),
    ).toEqual(["4"]);
    expect(result.cohorts.expired.rows.map((row) => row.membershipId)).toEqual([
      "6",
    ]);
    expect(
      Object.values(result.cohorts).every((cohort) => cohort.state === "ready"),
    ).toBe(true);
  });
  it("fails closed when totals, plan mix, customer names or source completeness do not reconcile", () => {
    const data = input();
    data.dashboard.summary.activeMembers = 3;
    expect(buildMembershipCustomers(data).cohorts.activeMembers).toEqual({
      state: "unavailable",
      count: 3,
      rows: [],
    });
    const wrongPlan = input();
    wrongPlan.membershipDetails[0]!.MembershipType = "Monthly";
    expect(
      buildMembershipCustomers(wrongPlan).cohorts.activeMembers.state,
    ).toBe("unavailable");
    const missingName = input();
    missingName.membershipDetails[0]!.CustomerName = "";
    expect(
      buildMembershipCustomers(missingName).cohorts.activeMembers.rows,
    ).toEqual([]);
    expect(
      buildMembershipCustomers({ ...input(), statusHistory: null }).cohorts
        .activeMembers.state,
    ).toBe("unavailable");
  });
  it("uses Los Angeles dates for changes, including UTC timestamps on the next day, and deduplicates events", () => {
    const data = input();
    data.statusHistory[2]!.createdOn = "2026-10-01T01:00:00Z";
    data.statusHistory.push(data.statusHistory[2]!);
    expect(
      buildMembershipCustomers(data).cohorts.cancellations.rows[0]!.date,
    ).toBe("2026-09-30");
  });
  it("counts sales events for the same customer independently, using Sold On and activation method", () => {
    const data = input();
    Object.assign(data.dashboard.summary, { newSales: 2, renewals: 1 });
    const sale = {
      ...detail(1),
      SoldOn: "2026-09-12T00:00:00-07:00",
      SoldBy: "CSR",
      ActivationMethod: "New Sale",
      From: "2026-09-12",
      To: "2027-09-11",
      paymentMethodId: "never expose",
      Memo: "private",
    };
    data.salesRows = [
      sale,
      { ...sale, CustomerMembershipId: 7 },
      { ...sale, ActivationMethod: "Renewal" },
      { ...sale, SoldOn: "2026-08-31" },
    ];
    const result = buildMembershipCustomers(data);
    expect(result.cohorts.newSales.rows).toHaveLength(2);
    expect(result.cohorts.renewals.rows).toHaveLength(1);
    expect(result.cohorts.renewals.rows[0]).toMatchObject({
      customerName: "Customer 1",
      soldBy: "CSR",
      date: "2026-09-12",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /never expose|private|paymentMethodId|Memo/,
    );
    delete data.salesRows[0]!.CustomerMembershipId;
    expect(buildMembershipCustomers(data).cohorts.newSales.state).toBe(
      "unavailable",
    );
  });
  it("distinguishes a complete empty cohort from unavailable data", () => {
    const data = input();
    expect(buildMembershipCustomers(data).cohorts.renewals).toEqual({
      state: "ready",
      count: 0,
      rows: [],
    });
    expect(
      buildMembershipCustomers({ ...data, salesRows: null }).cohorts.renewals
        .state,
    ).toBe("unavailable");
  });
});
