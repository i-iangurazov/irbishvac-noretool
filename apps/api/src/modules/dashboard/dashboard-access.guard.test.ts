import { describe, expect, it, vi } from "vitest";
import { DashboardAccessGuard } from "./dashboard-access.guard";

vi.mock("@irbis/config", () => ({
  getConfig: () => ({ auth: { cookieSecret: "expected-secret" } }),
}));

function contextWithToken(token?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: token ? { "x-dashboard-access-token": token } : {},
      }),
    }),
  } as never;
}

describe("DashboardAccessGuard", () => {
  it("accepts the internal dashboard token", () => {
    expect(
      new DashboardAccessGuard().canActivate(
        contextWithToken("expected-secret"),
      ),
    ).toBe(true);
  });

  it.each([undefined, "", "wrong-secret", "expected-secret-extra"])(
    "rejects an invalid internal dashboard token: %s",
    (token) => {
      expect(() =>
        new DashboardAccessGuard().canActivate(contextWithToken(token)),
      ).toThrow("Dashboard access is not authorized");
    },
  );
});
