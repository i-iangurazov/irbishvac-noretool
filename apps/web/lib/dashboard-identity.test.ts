import { describe, expect, it } from "vitest";
import {
  isAllowedDashboardIdentity,
  SHARED_DASHBOARD_USER_ID,
} from "./dashboard-identity";

describe("Dashboard identity", () => {
  it("allows the exact provisioned shared user without an email", () => {
    expect(
      isAllowedDashboardIdentity({
        isAuthenticated: true,
        userId: SHARED_DASHBOARD_USER_ID,
        primaryEmail: null,
      }),
    ).toBe(true);
  });

  it.each(["employee@irbishvac.com", "Employee@IRBISHVAC.COM"])(
    "preserves corporate access for %s",
    (primaryEmail) => {
      expect(
        isAllowedDashboardIdentity({
          isAuthenticated: true,
          userId: "user_employee",
          primaryEmail,
        }),
      ).toBe(true);
    },
  );

  it.each([
    undefined,
    null,
    "",
    "employee@example.com",
    "employee@irbishvac.com.example.com",
  ])("denies other authenticated users with email %s", (primaryEmail) => {
    expect(
      isAllowedDashboardIdentity({
        isAuthenticated: true,
        userId: "user_outsider",
        primaryEmail,
      }),
    ).toBe(false);
  });

  it.each([SHARED_DASHBOARD_USER_ID, "user_employee", null])(
    "requires authentication regardless of claimed identity %s",
    (userId) => {
      expect(
        isAllowedDashboardIdentity({
          isAuthenticated: false,
          userId,
          primaryEmail: "employee@irbishvac.com",
        }),
      ).toBe(false);
    },
  );

  it.each([
    "irbis-tv",
    SHARED_DASHBOARD_USER_ID + "_spoof",
    SHARED_DASHBOARD_USER_ID.toUpperCase(),
    null,
  ])("rejects a username, similar ID, or absent identity: %s", (userId) => {
    expect(isAllowedDashboardIdentity({ isAuthenticated: true, userId })).toBe(
      false,
    );
  });
});
