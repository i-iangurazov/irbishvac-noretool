import type { ServiceTitanReportDefinition } from "@irbis/integrations";

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
