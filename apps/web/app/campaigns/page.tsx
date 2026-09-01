import augustCampaignData from "../../data/campaign-performance-august.json";
import julyCampaignData from "../../data/campaign-performance-july.json";
import {
  CampaignPerformancePage,
  type CampaignPerformanceData,
} from "../../components/campaign-performance-page";
import { fetchApi } from "../../lib/api";

type CampaignsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const fallbackDatasets = [
    augustCampaignData as CampaignPerformanceData,
    julyCampaignData as CampaignPerformanceData,
  ];
  const params: Record<string, string | string[] | undefined> = await (
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>)
  );
  const requestedView = typeof params.view === "string" && ["overview", "revenue", "channels", "plan", "history"].includes(params.view)
    ? params.view as "overview" | "revenue" | "channels" | "plan" | "history"
    : "overview";
  const currentMonth = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: process.env.APP_TIMEZONE ?? "America/Los_Angeles"
  }).format(new Date());
  const requestedMonth = typeof params.month === "string" ? params.month : currentMonth;
  const fallbackByMonth = new Map(fallbackDatasets.map((fallback) => [
    fallback.period.id ?? fallback.period.from.slice(0, 7),
    fallback,
  ]));
  const monthIds = [...new Set([currentMonth, ...fallbackByMonth.keys()])];
  const liveDatasets = await Promise.all(monthIds.map(async (month) => {
    try {
      return await fetchApi<CampaignPerformanceData | null>(
        `/dashboard/campaigns/performance?month=${encodeURIComponent(month)}`,
      );
    } catch {
      return null;
    }
  }));
  const periodDatasets = monthIds.flatMap((month, index) => {
    const fallback = fallbackByMonth.get(month);
    const live = liveDatasets[index];
    if (live && (!fallback || Date.parse(live.generatedAt) >= Date.parse(fallback.generatedAt))) {
      return [live];
    }
    if (!fallback) return [];
    return [{
      ...fallback,
      dataStatus: "SNAPSHOT" as const,
      plan: {
        ...fallback.plan,
        approvalStatus: "draft" as const,
        version: `${month}-snapshot-model`,
        originalPlanLocked: true,
        status: month === "2026-08" ? "DRAFT MODEL - APPROVAL REQUIRED" : fallback.plan.status
      },
      sources: fallback.sources.map((source) => ({ ...source, status: "stale" as const, refreshedAt: fallback.generatedAt }))
    }];
  });
  const data = periodDatasets.find((dataset) => (dataset.period.id ?? dataset.period.from.slice(0, 7)) === requestedMonth)
    ?? periodDatasets[0]!;

  return (
    <CampaignPerformancePage
      data={data}
      periods={periodDatasets.map((dataset) => ({ id: dataset.period.id ?? dataset.period.from, from: dataset.period.from }))}
      refreshEnabled={(data.period.id ?? data.period.from.slice(0, 7)) === currentMonth}
      view={requestedView}
      history={periodDatasets}
    />
  );
}
