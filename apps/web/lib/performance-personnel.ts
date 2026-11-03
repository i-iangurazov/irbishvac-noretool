import "server-only";
import { getConfig } from "@irbis/config";
import type { PerformancePlan } from "./performance-data";
import type { ServiceTechDeliveryRow } from "./performance-delivery-source";

const number = (value: unknown) => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);

export function deliveryPlan(row: ServiceTechDeliveryRow, month: string, sourceKind?: "advisor" | "technician"): PerformancePlan {
  return {
    slug: row.slug, technician: row.technician, technicianId: row.technicianId ?? null, month,
    sourceKind: sourceKind ?? (row.department.includes("Sales") ? "advisor" : "technician"),
    department: row.department, aliases: [],
    approvalStatus: row.plan?.approvalStatus ?? "UPDATED_GOAL_PENDING",
    monthlySalesGoal: row.plan?.monthlySalesGoal ?? null,
    membershipMonthlyGoal: row.plan?.membershipMonthlyGoal ?? null,
    reviewMonthlyGoal: row.plan?.reviewMonthlyGoal ?? null,
    workingDaysMonthly: row.plan?.workingDaysMonthly ?? null,
    targetOpportunitiesMonthly: row.personalizedTargets?.targetOpportunitiesMonthly ?? null,
    targetRate: row.personalizedTargets?.targetRate ?? null,
    targetRateType: "close", targetAverage: row.personalizedTargets?.targetAverage ?? null,
    turnoverQuota: null,
  };
}

export async function loadPersonnelPlans(month?: string): Promise<PerformancePlan[]> {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  const config = getConfig();
  const response = await fetch(`${config.app.apiBaseUrl}/api/dashboard/personnel${query}`, {
    headers: { "x-dashboard-access-token": config.auth.cookieSecret }, cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("The current personnel directory is unavailable");
  const directory = await response.json() as { staff: Array<{
    slug: string; technicianId: string; technician: string; department: string;
    cycle: "advisor" | "technician" | "installer"; reportAliases: string[]; goal: Record<string, unknown>;
  }> };
  return directory.staff.filter(p => p.cycle !== "installer").map(p => {
    const g = p.goal;
    return {
      slug: p.slug, technicianId: p.technicianId, technician: p.technician, department: p.department,
      month: String(g.month), sourceKind: p.cycle as "advisor" | "technician", aliases: p.reportAliases ?? [],
      approvalStatus: g.approval_status === "ACTIVE" ? "ACTIVE" : "UPDATED_GOAL_PENDING",
      monthlySalesGoal: number(g.monthly_sales_goal), targetOpportunitiesMonthly: number(g.target_opportunities_monthly),
      targetRate: number(g.target_rate), targetAverage: number(g.target_average), targetRateType: "close",
      turnoverQuota: null, membershipMonthlyGoal: number(g.membership_monthly_goal),
      reviewMonthlyGoal: number(g.review_monthly_goal), workingDaysMonthly: number(g.working_days),
    };
  });
}
