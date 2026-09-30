import { describe, expect, it } from "vitest";
import {
  MEMBERSHIP_CHANNEL_PLAN,
  MEMBERSHIP_COMPANY_GOAL,
  MEMBERSHIP_DEPARTMENT_GOALS,
  MEMBERSHIP_RENEWAL_MILESTONES,
  MEMBERSHIP_TOTAL_MONTHLY_GOAL,
  membershipGoalStatus,
  membershipRenewalTarget,
} from "./membership-goals";

describe("membership conversion goals", () => {
  it("matches the approved conversion plan document", () => {
    expect(MEMBERSHIP_COMPANY_GOAL).toMatchObject({
      targetMembers: 1000,
      targetDate: "2026-12-31",
      planMonthlyNetRequired: 57,
      newSalesRequiredCurrentRenewal: 85,
      newSalesRequiredSixtyPercentRenewal: 70,
    });
    expect(MEMBERSHIP_RENEWAL_MILESTONES.map((m) => m.rate)).toEqual([
      0.4, 0.6,
    ]);
    expect(MEMBERSHIP_TOTAL_MONTHLY_GOAL).toEqual([200, 252]);
    expect(MEMBERSHIP_CHANNEL_PLAN).toHaveLength(5);
    // Field/sales department ranges add up to the document's department total
    // (CSR is tracked separately in Section 3).
    const departmentLow = MEMBERSHIP_DEPARTMENT_GOALS.filter(
      (goal) => goal.department !== "csr",
    ).reduce((sum, goal) => sum + goal.monthly[0], 0);
    expect(departmentLow).toBe(155);
    // Adding the CSR line reaches the document's total new-sales potential.
    const csr = MEMBERSHIP_DEPARTMENT_GOALS.find(
      (goal) => goal.department === "csr",
    );
    expect(departmentLow + csr!.monthly[0]).toBe(185);
  });
  it("picks the renewal milestone the team is driving toward", () => {
    expect(membershipRenewalTarget("2026-07-15").rate).toBe(0.4);
    expect(membershipRenewalTarget("2026-08-31").rate).toBe(0.4);
    expect(membershipRenewalTarget("2026-09-30").rate).toBe(0.6);
    expect(membershipRenewalTarget("2027-06-01").rate).toBe(0.6);
    expect(membershipRenewalTarget("2026-09-30").previous?.rate).toBe(0.4);
  });
  it("classifies goal attainment against the document range", () => {
    expect(membershipGoalStatus(50, [40, 48])).toBe("met");
    expect(membershipGoalStatus(25, [40, 48])).toBe("behind");
    expect(membershipGoalStatus(35, [40, 48])).toBe("on-track");
    expect(membershipGoalStatus(30, [40, 48])).toBe("on-track");
    expect(membershipGoalStatus(null, [40, 48])).toBe("unknown");
  });
});
