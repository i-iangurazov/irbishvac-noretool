import { fetchApi } from "../../lib/api";
import { CompanyWidePage } from "../../components/company-wide-page";
import { resolveDashboardFilters } from "../../lib/dashboard-filters";

type CompanyWideRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CompanyWideRoute({ searchParams }: CompanyWideRouteProps) {
  const filters = await resolveDashboardFilters(searchParams, "America/Los_Angeles");
  const data = await fetchApi(`/dashboard/company-wide?${filters.apiQueryString}`);
  return <CompanyWidePage data={data as never} filters={filters} />;
}
