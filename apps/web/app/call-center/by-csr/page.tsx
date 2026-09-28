import type { CsrPerformanceDashboard } from "@irbis/domain";
import { fetchApi } from "../../../lib/api";
import { resolveDashboardFilters } from "../../../lib/dashboard-filters";
import { CsrDashboard } from "../csr-dashboard";

export default async function CallCenterByCsrPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await resolveDashboardFilters(
    searchParams,
    "America/Los_Angeles",
    "/call-center/by-csr",
  );
  const data = await fetchApi<CsrPerformanceDashboard>(
    `/dashboard/call-center/by-csr?${filters.apiQueryString}`,
  );
  return <CsrDashboard data={data} filters={filters} view="by-csr" />;
}
