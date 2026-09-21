// @vitest-environment node
import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import august from "../data/campaign-performance-august.json";
import { GET } from "../app/api/v1/campaigns/[[...path]]/route";
import { authorizeCampaignIntegration } from "./campaign-integration-auth";
import { isCampaignIntegrationPath } from "./auth-policy";

vi.mock("@irbis/config", () => ({ getConfig: () => ({ app: { timezone: "America/Los_Angeles", apiBaseUrl: "https://internal.example" }, auth: { cookieSecret: "internal-only-secret" } }) }));

let key: string;
let snapshot: typeof august;
const fetchMock = vi.fn();
const now = Date.parse("2026-09-21T12:00:00Z");
function request(path = "performance?month=2026-09", token: string | null = key) {
  return new NextRequest(`https://web.example/api/v1/campaigns/${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
}
async function get(path = "performance?month=2026-09", token: string | null = key) {
  return GET(request(path, token), { params: Promise.resolve({ path: path.split("?")[0]!.split("/") }) });
}

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  key = `irbis_campaigns_${randomBytes(32).toString("base64url")}`;
  vi.stubEnv("CAMPAIGNS_READ_API_KEY_SHA256", createHash("sha256").update(key).digest("hex"));
  vi.stubEnv("CAMPAIGNS_READ_API_KEY_EXPIRES_AT", "2027-09-21T23:59:59Z");
  vi.spyOn(console, "info").mockImplementation(() => {});
  snapshot = structuredClone(august);
  snapshot.period.from = "2026-09-01"; snapshot.period.to = "2026-09-20";
  snapshot.generatedAt = "2026-09-21T08:00:00Z";
  fetchMock.mockReset().mockResolvedValue(Response.json(snapshot));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Campaigns integration boundary", () => {
  it.each([null, "wrong-token", "internal-only-secret"])("rejects missing, incorrect and internal credentials (%s)", async (token) => {
    expect((await get(undefined, token)).status).toBe(401); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([undefined, "invalid", "2026-09-21T12:00:00Z"])("fails closed with missing, malformed or expired validity (%s)", async (expiry) => {
    vi.stubEnv("CAMPAIGNS_READ_API_KEY_EXPIRES_AT", expiry);
    expect((await get()).status).toBe(401); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("revokes access immediately when the configured hash is removed or replaced", async () => {
    vi.stubEnv("CAMPAIGNS_READ_API_KEY_SHA256", ""); expect((await get()).status).toBe(401);
    vi.stubEnv("CAMPAIGNS_READ_API_KEY_SHA256", "a".repeat(64)); expect((await get()).status).toBe(401);
  });
  it("limits a valid integration to 60 requests per minute", () => {
    for (let i = 0; i < 60; i++) expect(authorizeCampaignIntegration(request(), now).authorized).toBe(true);
    expect(authorizeCampaignIntegration(request(), now)).toMatchObject({ status: 429, retryAfter: 60 });
    expect(authorizeCampaignIntegration(request(), now + 60_000).authorized).toBe(true);
  });
  it.each(["/api/dashboard/campaigns/performance", "/api/v1/company-wide", "/api/v1/campaigns-other", "/campaigns"])("retains normal authentication outside the dedicated API: %s", (path) => {
    expect(isCampaignIntegrationPath(path)).toBe(false);
  });
  it("recognizes only the integration path boundary", () => {
    expect(isCampaignIntegrationPath("/api/v1/campaigns/performance")).toBe(true);
    expect(isCampaignIntegrationPath("/api/v1/campaigns")).toBe(true);
  });
  it.each(["performance/refresh", "performance/inputs", "technicians"])("does not proxy arbitrary operations: %s", async (path) => {
    expect((await get(path)).status).toBe(404); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns business data without exposing internal credentials or report IDs", async () => {
    const response = await get(); const body = await response.json();
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.data.overview.bookedJobs).toBe(snapshot.actual.bookedJobs);
    expect(body.data.rows).toHaveLength(snapshot.rows.length);
    expect(body.data.sources.every((source: object) => !("reportId" in source))).toBe(true);
    expect(JSON.stringify(body)).not.toContain("internal-only-secret");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://internal.example/api/dashboard/campaigns/performance?month=2026-09");
    expect(init.headers).toEqual({ "x-dashboard-access-token": "internal-only-secret" });
  });
  it.each(["performance?month=2026-13", "performance?month=2027-01", "performance?month=2026-09&month=2026-08", "history?from=2025-01&to=2026-09", "history?from=2026-09&to=2026-08", "performance?path=company-wide"])("rejects invalid or unbounded queries: %s", async (path) => {
    expect((await get(path)).status).toBe(400); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not silently substitute a different month for a missing one", async () => {
    fetchMock.mockImplementation(async () => Response.json(null)); expect((await get()).status).toBe(404);
  });
  it("distinguishes an upstream outage from a missing month", async () => {
    fetchMock.mockRejectedValue(new Error("private connection details"));
    const response = await get(); expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private connection details");
  });
  it("marks historical fallbacks explicitly, matching the dashboard", async () => {
    fetchMock.mockRejectedValue(new Error("unavailable"));
    const response = await get("performance?month=2026-08"); const body = await response.json();
    expect(response.status).toBe(200); expect(body.data.dataStatus).toBe("SNAPSHOT");
    expect(body.data.sources.every((source: {status: string}) => source.status === "stale")).toBe(true);
  });
  it("returns monthly history and the same paid/organic chart series", async () => {
    const response = await get("history?from=2026-09&to=2026-09"); const body = await response.json();
    expect(response.status).toBe(200); expect(body.data).toHaveLength(1);
    expect(body.series.bookedJobs[0].month).toBe("2026-09"); expect(body.unavailableMonths).toEqual([]);
  });
  it("keeps default history bounded as the integration ages", async () => {
    vi.setSystemTime(Date.parse("2027-09-20T12:00:00Z"));
    fetchMock.mockImplementation(async () => Response.json(null));
    const response = await get("history"); const body = await response.json();
    expect(response.status).toBe(200); expect(fetchMock).toHaveBeenCalledTimes(12);
    expect(body.unavailableMonths[0]).toBe("2026-10");
  });
  it("reports unavailable lead metrics as null in the overview", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...snapshot, leadDataStatus: "unavailable" }));
    const body = await (await get()).json(); expect(body.data.overview.bookedJobs).toBeNull(); expect(body.data.overview.bookingRate.total).toBeNull();
  });
});
