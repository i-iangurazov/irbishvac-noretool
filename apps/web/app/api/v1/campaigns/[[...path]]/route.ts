import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@irbis/config";
import type { CampaignPerformanceData } from "../../../../../components/campaign-performance-page";
import { authorizeCampaignIntegration } from "../../../../../lib/campaign-integration-auth";
import { campaignIntegrationReport } from "../../../../../lib/campaign-integration-data";
import { campaignMonthIds, performanceSeries, type PerformanceMetric } from "../../../../../lib/campaign-overview";
import { campaignFallbacks, resolveCampaignSnapshot } from "../../../../../lib/campaign-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function validMonth(value: string) { return /^20\d{2}-(0[1-9]|1[0-2])$/.test(value); }

async function readSnapshot(month: string) {
  let live: CampaignPerformanceData | null;
  try {
    const config = getConfig();
    const url = new URL("/api/dashboard/campaigns/performance", config.app.apiBaseUrl);
    url.searchParams.set("month", month);
    const response = await fetch(url, {
      headers: { "x-dashboard-access-token": config.auth.cookieSecret },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Upstream unavailable");
    live = await response.json() as CampaignPerformanceData | null;
    if (live && (live.period?.from?.slice(0, 7) !== month || !live.actual || !Array.isArray(live.rows) || !Number.isFinite(Date.parse(live.generatedAt)))) throw new Error("Invalid upstream snapshot");
  } catch {
    const fallback = resolveCampaignSnapshot(month, null);
    if (fallback) return fallback;
    throw new ApiError(503, "Campaign data is temporarily unavailable. Retry later.");
  }
  return resolveCampaignSnapshot(month, live);
}

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const started = Date.now();
  const access = authorizeCampaignIntegration(request);
  const { path = [] } = await context.params;
  const operation = path.length === 1 && ["performance", "periods", "history"].includes(path[0]!) ? path[0]! : "unknown";
  function reply(body: unknown, status = 200, extra: Record<string, string> = {}) {
    console.info(JSON.stringify({ event: "campaigns.integration.read", client: access.authorized ? access.client : "unauthorized", operation, status, durationMs: Date.now() - started }));
    return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", ...extra } });
  }
  if (!access.authorized) return reply({ error: access.status === 429 ? "Rate limit exceeded" : "Invalid or expired API key" }, access.status,
    access.status === 429 ? { "Retry-After": String(access.retryAfter) } : { "WWW-Authenticate": 'Bearer realm="campaigns"' });
  if (operation === "unknown") return reply({ error: "Endpoint not found" }, 404);

  try {
    const timezone = getConfig().app.timezone;
    const currentMonth = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: timezone }).format(new Date());
    const query = request.nextUrl.searchParams;
    const allowed = operation === "performance" ? ["month"] : operation === "history" ? ["from", "to"] : [];
    if ([...query.keys()].some((key) => !allowed.includes(key) || query.getAll(key).length !== 1)) throw new ApiError(400, "Unsupported or repeated query parameter");
    const meta = { apiVersion: "1", timezone, currency: "USD" };
    if (operation === "performance") {
      const month = query.get("month") ?? currentMonth;
      if (!validMonth(month) || month > currentMonth) throw new ApiError(400, "month must be YYYY-MM and cannot be in the future");
      const data = await readSnapshot(month);
      if (!data) throw new ApiError(404, "No Campaigns data is available for this month");
      return reply({ meta, data: campaignIntegrationReport(data) });
    }
    let months = campaignMonthIds(currentMonth, currentMonth, [...campaignFallbacks.keys()]);
    if (operation === "history") {
      const from = query.get("from") ?? months.slice(-12)[0]!;
      const to = query.get("to") ?? currentMonth;
      if (!validMonth(from) || !validMonth(to) || from > to || to > currentMonth) throw new ApiError(400, "from and to must be YYYY-MM, ordered, and not in the future");
      const start = Number(from.slice(0, 4)) * 12 + Number(from.slice(5)) - 1;
      const end = Number(to.slice(0, 4)) * 12 + Number(to.slice(5)) - 1;
      if (end - start >= 12) throw new ApiError(400, "Request at most 12 months of history at a time");
      months = Array.from({ length: end - start + 1 }, (_, i) => `${Math.floor((start + i) / 12)}-${String((start + i) % 12 + 1).padStart(2, "0")}`);
    }
    const snapshots = await Promise.all(months.map(readSnapshot));
    const data = snapshots.filter((value): value is CampaignPerformanceData => value !== null);
    if (operation === "periods") return reply({ meta, data: data.map((value) => ({ month: value.period.id ?? value.period.from.slice(0, 7), from: value.period.from, to: value.period.to, generatedAt: value.generatedAt, dataStatus: value.dataStatus ?? "SNAPSHOT" })) });
    return reply({
      meta, data: data.map(campaignIntegrationReport),
      unavailableMonths: months.filter((_, i) => snapshots[i] === null),
      series: Object.fromEntries((["qualifiedLeads", "bookedJobs", "completedRevenue", "soldAmount"] as PerformanceMetric[]).map((metric) => [metric, performanceSeries(data, metric)])),
    });
  } catch (error) {
    return reply({ error: error instanceof ApiError ? error.message : "Campaign data is temporarily unavailable" }, error instanceof ApiError ? error.status : 503);
  }
}
