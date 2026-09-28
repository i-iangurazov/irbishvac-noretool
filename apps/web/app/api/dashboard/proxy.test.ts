import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { proxyDashboardRequest } from "./proxy";
import { SHARED_DASHBOARD_USER_ID } from "../../../lib/dashboard-identity";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@irbis/config", () => ({
  getConfig: () => ({ auth: { cookieSecret: "synthetic-test-server-secret" } }),
}));

const fetchMock = vi.fn();
function session(
  isAuthenticated: boolean,
  userId: string | null,
  primaryEmail: string | null,
) {
  vi.mocked(auth).mockResolvedValue({
    isAuthenticated,
    userId,
    sessionClaims: primaryEmail ? { primaryEmail } : null,
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  vi.stubEnv("PERFORMANCE_REPORT_RENDER_MODE", "false");
  fetchMock.mockResolvedValue(
    new Response('{"ok":true}', {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Dashboard proxy shared-account access", () => {
  it.each([["goals"], ["campaigns", "performance", "inputs"]])(
    "permits a shared-account write to %s using the same server credential",
    async (...path) => {
      session(true, SHARED_DASHBOARD_USER_ID, null);
      const payload = JSON.stringify({ synthetic: true, amount: 123 });
      const response = await proxyDashboardRequest(
        new NextRequest(
          "https://dashboard.example.test/api/dashboard/" + path.join("/"),
          { method: "POST", body: payload },
        ),
        path,
      );
      expect(response.status).toBe(200);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(String(url)).toBe(
        "https://api.example.test/api/dashboard/" + path.join("/"),
      );
      expect(init.method).toBe("POST");
      expect(init.body).toBe(payload);
      expect(init.headers.get("x-dashboard-access-token")).toBe(
        "synthetic-test-server-secret",
      );
      if (path.join("/") === "campaigns/performance/inputs") {
        expect(init.headers.get("x-dashboard-write-token")).toBe(
          "synthetic-test-server-secret",
        );
      }
    },
  );

  it("preserves corporate-user writes", async () => {
    session(true, "user_employee", "employee@irbishvac.com");
    expect(
      (
        await proxyDashboardRequest(
          new NextRequest(
            "https://dashboard.example.test/api/dashboard/goals",
            { method: "POST", body: "{}" },
          ),
          ["goals"],
        )
      ).status,
    ).toBe(200);
  });

  it.each([
    [false, SHARED_DASHBOARD_USER_ID, null],
    [true, "user_outsider", "person@example.com"],
    [true, "irbis-tv", null],
  ] as const)(
    "denies an untrusted request before any upstream write (%s, %s)",
    async (authenticated, id, email) => {
      session(authenticated, id, email);
      const response = await proxyDashboardRequest(
        new NextRequest("https://dashboard.example.test/api/dashboard/goals", {
          method: "POST",
          body: "{}",
          headers: { "x-user-id": SHARED_DASHBOARD_USER_ID },
        }),
        ["goals"],
      );
      expect(response.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});


describe("membership notes authorization",()=>{
  const path=["call-center","memberships","services","123","notes"];
  const request=(origin="https://dashboard.example.test",headers:Record<string,string>={})=>new NextRequest("https://dashboard.example.test/api/dashboard/"+path.join("/"),{method:"POST",headers:{origin,"content-type":"application/json","x-membership-note":"1",...headers},body:JSON.stringify({body:"Example",requestId:"8b905e5a-9f23-4e7e-a00c-c5f89d4acb28"})});
  it("rejects cross-origin and simple writes before contacting the API",async()=>{
    session(true,"user_verified","verified@irbishvac.com");
    expect((await proxyDashboardRequest(request("https://outside.example"),path)).status).toBe(403);
    expect((await proxyDashboardRequest(request("https://dashboard.example.test",{"x-membership-note":""}),path)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("replaces forged authors with authenticated server identity",async()=>{
    session(true,"user_verified","verified@irbishvac.com");
    const r=await proxyDashboardRequest(request("https://dashboard.example.test",{"x-dashboard-user-label":"forged@irbishvac.com","x-dashboard-user-id":"forged"}),path);
    expect(r.status).toBe(200);const headers=fetchMock.mock.calls[0]![1].headers as Headers;
    expect(headers.get("x-dashboard-user-label")).toBe("verified@irbishvac.com");expect(headers.get("x-dashboard-user-id")).toBe("user_verified");
  });
  it("preserves approved shared-account note access with an explicit author label",async()=>{
    session(true,SHARED_DASHBOARD_USER_ID,null);
    expect((await proxyDashboardRequest(request(),path)).status).toBe(200);
    expect(fetchMock.mock.calls[0]![1].headers.get("x-dashboard-user-label")).toBe("Shared dashboard");
  });
});
