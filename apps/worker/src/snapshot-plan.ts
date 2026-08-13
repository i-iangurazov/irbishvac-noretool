import { getConfig } from "@irbis/config";
import {
  getServiceTitanReportDefinitions,
  resolveReportRequest,
  type ReportFamilyKey,
  type ReportRequestContext
} from "@irbis/integrations";
import { toBusinessDateString } from "@irbis/utils";

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
const FIELD_PRO_FAMILIES: ReportFamilyKey[] = [
  "fieldProTechnicianActivity",
  "fieldProJobRecordings"
];

function getLastCompletedWeek(timeZone: string, referenceDate = new Date()) {
  const today = toBusinessDateString(referenceDate, timeZone);
  const todayDate = new Date(`${today}T12:00:00.000Z`);
  const daysSinceMonday = (todayDate.getUTCDay() + 6) % 7;
  const currentMonday = new Date(todayDate);
  currentMonday.setUTCDate(currentMonday.getUTCDate() - daysSinceMonday);
  const previousMonday = new Date(currentMonday);
  previousMonday.setUTCDate(previousMonday.getUTCDate() - 7);
  const previousSunday = new Date(currentMonday);
  previousSunday.setUTCDate(previousSunday.getUTCDate() - 1);

  return {
    from: previousMonday.toISOString().slice(0, 10),
    to: previousSunday.toISOString().slice(0, 10)
  };
}

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

  const fieldProContext = getLastCompletedWeek(config.app.timezone);
  for (const family of FIELD_PRO_FAMILIES) {
    const definition = definitions[family];
    const request = resolveReportRequest(definition, {
      ...fieldProContext,
      timezone: config.app.timezone
    });

    deduped.set(`${family}:${request.requestHash}`, {
      family,
      context: fieldProContext,
      requestHash: request.requestHash,
      label: `${family}:last-completed-week`
    });
  }

  return Array.from(deduped.values());
}
