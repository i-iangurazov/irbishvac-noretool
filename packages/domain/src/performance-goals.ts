import type { PerformanceStaff } from "./personnel";

export type PerformanceGoal = {
  technicianId: string;
  technician: string;
  month: string;
  report_department: string;
  approval_status: "ACTIVE" | "UPDATED_GOAL_PENDING";
  source_note: string;
  monthly_sales_goal: number | null;
  target_opportunities_monthly: number | null;
  target_rate: number | null;
  target_average: number | null;
  membership_monthly_goal: number | null;
  review_monthly_goal: number | null;
  working_days: number | null;
};

export function assertGoalMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Goal month must be YYYY-MM");
}

export function resolvePerformanceGoal(person: PerformanceStaff, month: string, approved?: PerformanceGoal | null): PerformanceGoal {
  assertGoalMonth(month);
  const matches = approved?.approval_status === "ACTIVE" && approved.technicianId === person.technicianId
    && approved.month === month && approved.report_department === person.department;
  const goal: PerformanceGoal = matches ? { ...approved } : {
    technicianId: person.technicianId, technician: person.technician, month,
    report_department: person.department, approval_status: "UPDATED_GOAL_PENDING",
    source_note: "Current-month, current-department goals have not been approved.",
    monthly_sales_goal: null, target_opportunities_monthly: null, target_rate: null, target_average: null,
    membership_monthly_goal: null, review_monthly_goal: null, working_days: null,
  };
  goal.technician = person.technician;
  if (person.cycle === "advisor" && month >= "2026-11") goal.target_opportunities_monthly = 75;
  return goal;
}

export function validateApprovedPerformanceGoal(input: PerformanceGoal) {
  assertGoalMonth(input.month);
  if (!input.technicianId || !input.technician || !input.report_department || input.approval_status !== "ACTIVE")
    throw new Error("An approved goal needs employee ID, name, department and ACTIVE status");
  if ([input.monthly_sales_goal, input.target_opportunities_monthly, input.target_rate, input.target_average].some(value => value === null || typeof value !== "number" || value <= 0))
    throw new Error("Approved sales goals require positive sales, opportunities, close rate and average sale; unavailable goals stay pending");
  for (const key of ["monthly_sales_goal", "target_opportunities_monthly", "target_rate", "target_average", "membership_monthly_goal", "review_monthly_goal", "working_days"] as const) {
    const value = input[key];
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) throw new Error(`Invalid ${key}`);
  }
  if (input.target_rate !== null && input.target_rate > 1) throw new Error("Close rate cannot exceed 100%");
  if (input.working_days === 0) throw new Error("Working days must be positive or pending");
}

export type AdvisorHistoryMonth = {
  month: string; sales: number; opportunities: number; closedOpportunities: number;
  employed: boolean; complete: boolean;
};

/** Raymond's October 29 instruction: sales/ticket x1.50, relative close-rate x1.15. */
export function calculateAdvisorTargets(month: string, history: AdvisorHistoryMonth[]) {
  assertGoalMonth(month);
  const end = new Date(`${month}-01T12:00:00Z`);
  const expected = new Set<string>();
  for (let i = 1; i <= 10; i++) {
    const d = new Date(end); d.setUTCMonth(d.getUTCMonth() - i);
    expected.add(d.toISOString().slice(0, 7));
  }
  if (history.length !== 10 || new Set(history.map(row => row.month)).size !== 10 || history.some(row => !expected.has(row.month) || !row.complete))
    throw new Error("All ten completed calendar months must be accounted for");
  const eligible = history.filter(row => row.employed);
  if (!eligible.length) throw new Error("Employment history unavailable");
  if (history.some(row => [row.sales, row.opportunities, row.closedOpportunities].some(value => !Number.isFinite(value) || value < 0) || row.closedOpportunities > row.opportunities))
    throw new Error("Invalid historical sales or opportunity counts");
  const sales = eligible.reduce((sum, row) => sum + row.sales, 0);
  const opportunities = eligible.reduce((sum, row) => sum + row.opportunities, 0);
  const closed = eligible.reduce((sum, row) => sum + row.closedOpportunities, 0);
  if (!closed || !opportunities) throw new Error("Average sale and close rate cannot be calculated from empty history");
  const targetRate = Math.round(closed / opportunities * 1.15 * 1e8) / 1e8;
  if (targetRate > 1) throw new Error("Calculated close-rate target exceeds 100%; management review required");
  const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const monthlySalesGoal = money(sales / eligible.length * 1.5);
  const targetAverage = money(sales / closed * 1.5);
  return {
    monthlySalesGoal, targetAverage, targetRate, targetOpportunitiesMonthly: 75,
    historyMonths: eligible.length,
    salesImpliedByDials: money(75 * targetRate * targetAverage),
    salesGoalDifference: money(monthlySalesGoal - 75 * targetRate * targetAverage),
  };
}
