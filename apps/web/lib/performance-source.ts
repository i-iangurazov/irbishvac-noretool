import "server-only";

import { toBusinessDateString } from "@irbis/utils";
import { fetchApi } from "./api";
import {
  buildPerformanceRoster,
  mergeFieldProIntoRoster,
  type FieldProTechnicianActual,
  type PerformanceActual,
  type PerformanceRosterRow
} from "./performance-data";

type TechnicianDashboardPayload = {
  rowsRanked: Array<{
    name: string;
    businessUnit: string;
    technicianId: string | null;
    totalInfluencedRevenue: number;
    salesOpportunity: number;
    closedOpportunities: number;
    closeRate: number;
    avgSaleFromOpps: number;
    membershipsSold: number;
  }>;
  snapshotTime: string | null;
};

type AdvisorDashboardPayload = {
  rowsRanked: Array<{
    name: string;
    businessUnit: string | null;
    technicianId: string | null;
    totalSales: number;
    salesOpportunitiesCount: number;
    closedOpportunitiesCount: number;
    closeRateRolling: number;
    closedAverageSale: number;
  }>;
  snapshotTime: string | null;
};

type FieldProDashboardPayload = {
  rows: Array<{
    name: string;
    email: string | null;
    team: string | null;
    completedJobs: number;
    totalRecordings: number | null;
    qualityRecordings: number | null;
    qualityRecordingRate: number | null;
    recordingCoverage: number | null;
    averageRecordingMinutes: number | null;
    longestRecordingMinutes: number | null;
    recordedJobs: Array<{
      jobId: string;
      jobNumber: string | null;
      recordingTitle: string | null;
      durationMinutes: number | null;
    }>;
  }>;
  snapshotTime: string | null;
};

export type PerformanceRange = {
  from: string;
  to: string;
};

function emptyTechnicians(): TechnicianDashboardPayload {
  return { rowsRanked: [], snapshotTime: null };
}

function emptyAdvisors(): AdvisorDashboardPayload {
  return { rowsRanked: [], snapshotTime: null };
}

function emptyFieldPro(): FieldProDashboardPayload {
  return { rows: [], snapshotTime: null };
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await fetchApi<T>(path);
  } catch {
    return fallback;
  }
}

function queryForRange(range?: PerformanceRange) {
  return range
    ? new URLSearchParams({ from: range.from, to: range.to }).toString()
    : new URLSearchParams({ preset: "mtd" }).toString();
}

export async function loadPerformanceActuals(range?: PerformanceRange) {
  const query = queryForRange(range);
  const [technicians, advisors] = await Promise.all([
    safeFetch(`/dashboard/performance/technicians?${query}`, emptyTechnicians()),
    safeFetch(`/dashboard/performance/advisors?${query}`, emptyAdvisors())
  ]);
  const actuals: PerformanceActual[] = [
    ...technicians.rowsRanked.map((row) => ({
        name: row.name,
        sourceKind: "technician" as const,
        technicianId: row.technicianId,
        businessUnit: row.businessUnit,
        revenue: row.totalInfluencedRevenue,
        opportunities: row.salesOpportunity,
        closedOpportunities: row.closedOpportunities,
        rate: row.closeRate,
        averageSale: row.avgSaleFromOpps,
        membershipsSold: row.membershipsSold,
        snapshotTime: technicians.snapshotTime
      })),
    ...advisors.rowsRanked.map((row) => ({
      name: row.name,
      sourceKind: "advisor" as const,
      technicianId: row.technicianId,
      businessUnit: row.businessUnit,
      revenue: row.totalSales,
      opportunities: row.salesOpportunitiesCount,
      closedOpportunities: row.closedOpportunitiesCount,
      rate: row.closeRateRolling,
      averageSale: row.closedAverageSale,
      membershipsSold: null,
      snapshotTime: advisors.snapshotTime
    }))
  ];

  return actuals;
}

export async function loadFieldProActuals(
  range: PerformanceRange,
): Promise<FieldProTechnicianActual[]> {
  const query = queryForRange(range);
  const fieldPro = await safeFetch(
    `/dashboard/performance/field-pro?${query}`,
    emptyFieldPro(),
  );

  return fieldPro.rows.map((row) => ({
    ...row,
    snapshotTime: fieldPro.snapshotTime
  }));
}

export async function loadPerformanceRoster(
  cutoffDate = toBusinessDateString(new Date(), "America/Los_Angeles"),
): Promise<PerformanceRosterRow[]> {
  const [actuals, fieldPro] = await Promise.all([
    loadPerformanceActuals(),
    loadFieldProActuals(getLastCompletedWeek())
  ]);
  return mergeFieldProIntoRoster(
    buildPerformanceRoster(actuals, cutoffDate),
    fieldPro,
  );
}

export function getLastCompletedWeek(
  referenceDate = new Date(),
  timeZone = "America/Los_Angeles",
): PerformanceRange {
  const today = toBusinessDateString(referenceDate, timeZone);
  const todayDate = new Date(`${today}T12:00:00.000Z`);
  const weekday = todayDate.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
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
