import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FieldProTechnicianActual, PerformanceActual } from "./performance-data";

export type PerformanceAuditAlert = {
  jobId?: string;
  ruleId: string;
  severity: string;
  title: string;
};

export type ServiceTechDeliveryRow = {
  slug: string;
  technician: string;
  department: string;
  businessUnit: string;
  technicianId: string | null;
  email: string | null;
  actualSourceAvailable: boolean;
  plan?: {
    sourceMonth: string;
    approvalStatus: "ACTIVE" | "DRAFT" | "MISSING_SALES_GOAL" | "UPDATED_GOAL_PENDING";
    monthlySalesGoal: number | null;
    membershipMonthlyGoal: number | null;
    membershipConversionGoal: number | null;
    reviewMonthlyGoal: number | null;
    leadsSetGoal: number | null;
    installSalesGoal: number | null;
    installSalesActualSource: "total_sales" | "total_lead_sales" | null;
    workingDaysMonthly: number | null;
    sourceNote: string;
  };
  actual: Pick<
    PerformanceActual,
    "revenue" | "opportunities" | "closedOpportunities" | "rate" | "averageSale" | "membershipsSold"
  > & {
    membershipOpportunities: number;
    membershipConversionRate: number;
    leadsSet: number;
    replacementOpportunities: number;
    replacementLeadConversionRate: number;
    totalLeadSales: number;
    installSales: number | null;
    techLeadJobs?: number;
    closeRateFromTgl?: number;
    totalSalesFromTgl?: number;
    closeRateFromMarketingLeads?: number;
    totalSalesFromMarketingLeads?: number;
  };
  execution: {
    completedJobs: number;
    optionsPerOpportunity: number | null;
    recallsCaused: number;
    arrivalEligibleAppointments: number | null;
    onTimeFirstHalfAppointments: number | null;
    onTimeArrivalRate: number | null;
    onsiteEligibleAppointments: number | null;
    averageTimeOnSiteMinutes: number | null;
    hhrEffectiveDate: string | null;
    hhrEligibleJobs: number | null;
    hhrCompletedJobs: number | null;
    hhrCompletionRate: number | null;
    reviewsReceived: number | null;
    serviceTitanAssignedReviews: number | null;
    textMatchedReviews: number | null;
    averageReviewRating: number | null;
  };
  personalizedTargets?: {
    baselineFromDate: string | null;
    baselineToDate: string | null;
    baselineOpportunities: number | null;
    baselineRate: number | null;
    baselineAverageSale: number | null;
    targetOpportunitiesMonthly: number | null;
    dailyOpportunityGoal: number | null;
    targetRate: number | null;
    targetRateType: "close";
    targetAverage: number | null;
    rateBenchmark: number;
    rateStep: number;
    averageLift: number;
  };
  fieldPro: Omit<FieldProTechnicianActual, "name" | "email" | "team" | "snapshotTime">;
  audit: {
    status: "no_matched_alerts" | "coverage_unavailable" | "has_alerts";
    matchedAlerts: PerformanceAuditAlert[];
    coverageNote: string;
  };
};

export type ServiceTechDeliverySnapshot = {
  schemaVersion: number;
  reportVersion?: string;
  generatedAt: string;
  periodFrom: string;
  cutoffDate: string;
  serviceTitanSnapshotTime: string | null;
  auditCycleAt: string;
  auditSource: string;
  technicians: ServiceTechDeliveryRow[];
};

export async function loadServiceTechDeliverySnapshot(): Promise<ServiceTechDeliverySnapshot | null> {
  const filePath =
    process.env.PERFORMANCE_DELIVERY_SNAPSHOT_PATH ??
    path.resolve(process.cwd(), "../../generated/service-tech-mtd-delivery.tmp.json");

  try {
    return JSON.parse(await readFile(filePath, "utf8")) as ServiceTechDeliverySnapshot;
  } catch {
    return null;
  }
}
