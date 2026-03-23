import { getConfig } from "@irbis/config";
import {
  getServiceTitanReportDefinitions,
  resolveReportRequest,
  type ReportFamilyKey,
  type ReportRequestContext
} from "@irbis/integrations";

export type SnapshotPlanContext = Pick<ReportRequestContext, "preset" | "from" | "to">;

export type SnapshotPlanItem = {
  family: ReportFamilyKey;
  context: SnapshotPlanContext;
  requestHash: string;
  label: string;
};

type SnapshotPlanOptions = {
  skipUnresolved?: boolean;
};

const PLAN_FAMILIES: ReportFamilyKey[] = [
  "technicians",
  "installers",
  "advisors",
  "callCenterSummary",
  "callCenterByCsr",
  "leadGeneration",
  "campaigns",
  "trending",
  "marketing",
  "capacity",
  "jobCostingSummary",
  "revenueGoals",
  "salesToday",
  "salesYesterday",
  "salesMonthlyPace",
  "revenueMonthlyPace",
  "bookingRate"
];

const SNAPSHOT_PRESETS: Array<NonNullable<SnapshotPlanContext["preset"]>> = ["mtd", "ytd"];

export function buildLatestSnapshotPlan(options?: SnapshotPlanOptions): SnapshotPlanItem[] {
  const config = getConfig();
  const definitions = getServiceTitanReportDefinitions();
  const deduped = new Map<string, SnapshotPlanItem>();

  for (const family of PLAN_FAMILIES) {
    const definition = definitions[family];

    if (
      options?.skipUnresolved &&
      (!definition.category ||
        !definition.reportId ||
        definition.category === "UNRESOLVED" ||
        definition.reportId === "UNRESOLVED")
    ) {
      continue;
    }

    for (const preset of SNAPSHOT_PRESETS) {
      const context: SnapshotPlanContext = { preset };
      const request = resolveReportRequest(definition, {
        ...context,
        timezone: config.app.timezone
      });
      const key = `${family}:${request.requestHash}`;

      if (!deduped.has(key)) {
        deduped.set(key, {
          family,
          context,
          requestHash: request.requestHash,
          label: `${family}:${preset}`
        });
      }
    }
  }

  return Array.from(deduped.values());
}
