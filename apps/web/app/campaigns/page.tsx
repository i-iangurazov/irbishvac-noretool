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
  const requestedMonth = typeof params.month === "string" ? params.month : "2026-08";
  const currentMonth = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: process.env.APP_TIMEZONE ?? "America/Los_Angeles"
  }).format(new Date());
  const fallback = fallbackDatasets.find((dataset) => dataset.period.id === requestedMonth) ?? fallbackDatasets[0]!;
  let liveData: CampaignPerformanceData | null = null;
  try {
    liveData = await fetchApi<CampaignPerformanceData | null>(
      `/dashboard/campaigns/performance?month=${encodeURIComponent(requestedMonth)}`,
    );
  } catch {
    liveData = null;
  }
  const data = liveData && Date.parse(liveData.generatedAt) >= Date.parse(fallback.generatedAt)
    ? liveData
    : {
        ...fallback,
        dataStatus: "SNAPSHOT" as const,
        plan: {
          ...fallback.plan,
          status: requestedMonth === "2026-08" ? "MODEL PLAN" : fallback.plan.status
        },
        sources: fallback.sources.map((source) => ({
          ...source,
          status: "stale" as const,
          refreshedAt: fallback.generatedAt
        }))
      };
  const periodDatasets = liveData && !fallbackDatasets.some((dataset) => dataset.period.id === liveData?.period.id)
    ? [liveData, ...fallbackDatasets]
    : fallbackDatasets;

  return (
    <CampaignPerformancePage
      data={data}
      periods={periodDatasets.map((dataset) => ({ id: dataset.period.id ?? dataset.period.from, from: dataset.period.from }))}
      refreshEnabled={(data.period.id ?? data.period.from.slice(0, 7)) === currentMonth}
    />
  );
}
