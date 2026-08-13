import { toBusinessDateString } from "@irbis/utils";
import { PerformanceDashboardPage } from "../../components/performance-dashboard-page";
import { loadPerformanceRoster } from "../../lib/performance-source";

type PerformancePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function PerformancePage({ searchParams }: PerformancePageProps) {
  const cutoffDate = toBusinessDateString(new Date(), "America/Los_Angeles");
  const [roster, resolvedSearchParams] = await Promise.all([
    loadPerformanceRoster(cutoffDate),
    searchParams ?? Promise.resolve({})
  ]);

  return (
    <PerformanceDashboardPage
      cutoffDate={cutoffDate}
      roster={roster}
      searchParams={resolvedSearchParams}
    />
  );
}
