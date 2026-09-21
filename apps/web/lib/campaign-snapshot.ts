import august from "../data/campaign-performance-august.json";
import july from "../data/campaign-performance-july.json";
import type { CampaignPerformanceData } from "../components/campaign-performance-page";

export const campaignFallbacks = new Map<string, CampaignPerformanceData>(
  [july, august].map((value) => {
    const data = value as CampaignPerformanceData;
    return [data.period.id ?? data.period.from.slice(0, 7), data];
  }),
);

// Shared by the dashboard and integration API, including historical fallback status.
export function resolveCampaignSnapshot(month: string, live: CampaignPerformanceData | null) {
  const fallback = campaignFallbacks.get(month);
  if (live && (!fallback || Date.parse(live.generatedAt) >= Date.parse(fallback.generatedAt))) return live;
  if (!fallback) return null;
  return {
    ...fallback,
    dataStatus: "SNAPSHOT" as const,
    plan: {
      ...fallback.plan,
      approvalStatus: "draft" as const,
      version: `${month}-snapshot-model`,
      originalPlanLocked: true,
      status: month === "2026-08" ? "DRAFT MODEL - APPROVAL REQUIRED" : fallback.plan.status,
    },
    sources: fallback.sources.map((source) => ({ ...source, status: "stale" as const, refreshedAt: fallback.generatedAt })),
  };
}
