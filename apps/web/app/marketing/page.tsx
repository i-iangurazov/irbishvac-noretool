import "./marketing.css";
import { campaignMonthIds } from "../../lib/campaign-overview";
import { campaignFallbacks, resolveCampaignSnapshot } from "../../lib/campaign-snapshot";
import {
  CampaignPerformancePage,
  type CampaignPerformanceData,
} from "../../components/campaign-performance-page";
import { fetchApi } from "../../lib/api";

export const metadata = { title: "Marketing | IRBIS" };

type MarketingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MarketingPage({ searchParams }: MarketingPageProps) {
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
  const monthIds = campaignMonthIds(currentMonth, requestedMonth, [...campaignFallbacks.keys()]);
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
    const resolved = resolveCampaignSnapshot(month, liveDatasets[index] ?? null);
    return resolved ? [resolved] : [];
  });
  const data = periodDatasets.find((dataset) => (dataset.period.id ?? dataset.period.from.slice(0, 7)) === requestedMonth)
    ?? periodDatasets.at(-1)!;

  return (
    <CampaignPerformancePage
      data={data}
      unavailableMonth={requestedMonth !== (data.period.id ?? data.period.from.slice(0, 7)) && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : undefined}
      periods={periodDatasets.map((dataset) => ({ id: dataset.period.id ?? dataset.period.from.slice(0, 7), from: dataset.period.from }))}
      refreshEnabled={(data.period.id ?? data.period.from.slice(0, 7)) === currentMonth}
      view={requestedView}
      history={periodDatasets}
    />
  );
}
