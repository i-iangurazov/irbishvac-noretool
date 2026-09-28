import type { MembershipPerformance } from "@irbis/domain";
import { fetchApi } from "../../lib/api";
import { resolveDashboardFilters } from "../../lib/dashboard-filters";
import { MembershipDashboard } from "../call-center/memberships/membership-dashboard";

export default async function MembershipPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await resolveDashboardFilters(
    searchParams,
    "America/Los_Angeles",
    "/memberships",
  );
  const data = await fetchApi<MembershipPerformance>(
    `/dashboard/call-center/memberships?${filters.apiQueryString}`,
  );
  return <MembershipDashboard data={data} filters={filters} />;
}
