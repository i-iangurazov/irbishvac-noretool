import type { ServiceTitanReportDefinition, ReportFamilyKey } from "@irbis/integrations";

type TvFamily = "technicians" | "installers" | "advisors";
/** Store relative periods: the business date is resolved when each job executes. */
export function buildTvRefreshJobs(
  definitions: Record<TvFamily, ServiceTitanReportDefinition>,
) {
  return (["technicians", "installers", "advisors"] as const)
    .filter((family) => {
      const definition = definitions[family];
      return (
        definition.category &&
        definition.reportId &&
        definition.category !== "UNRESOLVED" &&
        definition.reportId !== "UNRESOLVED"
      );
    })
    .map((family) => ({
      type: "refresh-family" as const,
      family,
      context: { preset: "mtd" as const },
    }));
}

export const COMPANY_TV_FAMILIES = [
  "trending", "marketing", "capacity", "jobCostingSummary", "revenueGoals",
  "salesToday", "salesYesterday", "salesMonthlyPace", "revenueMonthlyPace", "bookingRate",
] as const satisfies readonly ReportFamilyKey[];

/** Resolve relative dates at execution time so the schedule survives month rollover. */
export function buildCompanyRefreshJobs(definitions: Record<ReportFamilyKey, ServiceTitanReportDefinition>) {
  return COMPANY_TV_FAMILIES.filter(family => {
    const definition = definitions[family];
    return definition.category && definition.reportId &&
      definition.category !== "UNRESOLVED" && definition.reportId !== "UNRESOLVED";
  }).map(family => ({type: "refresh-family" as const, family, context: {preset: "mtd" as const}}));
}
