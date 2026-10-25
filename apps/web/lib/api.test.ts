// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardApiError, fetchApi } from "./api";
import { auth } from "@clerk/nextjs/server";
import { SHARED_DASHBOARD_USER_ID } from "./dashboard-identity";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@irbis/config", () => ({
  getConfig: () => ({ auth: { cookieSecret: "test-server-secret" } }),
}));
const request = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", request);
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  vi.mocked(auth).mockResolvedValue({
    isAuthenticated: true,
    userId: SHARED_DASHBOARD_USER_ID,
    sessionClaims: null,
  } as never);
  request.mockResolvedValue(
    new Response('{"ok":true}', {
      headers: { "content-type": "application/json" },
    }),
  );
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("authenticated server API reads", () => {
  it("uses the configured backend directly, without a browser-cookie authentication round trip", async () => {
    await expect(fetchApi("/dashboard/advisors?preset=mtd")).resolves.toEqual({
      ok: true,
    });
    const [url, init] = request.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.example.test/api/dashboard/advisors?preset=mtd",
    );
    expect(new Headers(init.headers).get("cookie")).toBeNull();
    expect(new Headers(init.headers).get("x-dashboard-access-token")).toBe(
      "test-server-secret",
    );
    expect(init).toMatchObject({ cache: "no-store", redirect: "manual" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it.each([
    { isAuthenticated: false, userId: null },
    {
      isAuthenticated: true,
      userId: "outside",
      sessionClaims: { primaryEmail: "outside@example.com" },
    },
  ])("denies an untrusted identity before fetching", async (identity) => {
    vi.mocked(auth).mockResolvedValue(identity as never);
    await expect(fetchApi("/dashboard/advisors")).rejects.toMatchObject({
      status: 401,
    });
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    new Response("login", {
      status: 302,
      headers: { location: "https://login.example" },
    }),
    new Response("<html>login</html>", {
      headers: { "content-type": "text/html" },
    }),
    new Response("broken", { headers: { "content-type": "application/json" } }),
  ])(
    "rejects redirect/HTML/malformed payloads as typed failures",
    async (response) => {
      request.mockResolvedValue(response);
      await expect(fetchApi("/dashboard/advisors")).rejects.toBeInstanceOf(
        DashboardApiError,
      );
    },
  );
  it.each([
    [new TypeError("network"), 503],
    [new DOMException("timeout", "TimeoutError"), 504],
  ])(
    "turns transport failure into a recoverable status",
    async (error, status) => {
      request.mockRejectedValue(error);
      await expect(fetchApi("/dashboard/advisors")).rejects.toMatchObject({
        status,
      });
    },
  );
});
