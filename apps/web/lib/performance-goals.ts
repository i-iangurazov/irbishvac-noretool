export type TvPerformanceGoal = {
  monthlySalesGoal: number | null;
  targetOpportunitiesMonthly: number | null;
  targetRate: number | null;
  targetAverage: number | null;
  membershipMonthlyGoal: number | null;
  reviewMonthlyGoal: number | null;
  status: "ACTIVE" | "UPDATED_GOAL_PENDING";
};

// The API supplies a month- and department-scoped approved goal or pending fields.
// No employee names or historical targets belong in a display adapter.
export function getTvPerformanceGoal(goal: {
  approval_status: "ACTIVE" | "UPDATED_GOAL_PENDING";
  monthly_sales_goal: number | null; target_opportunities_monthly: number | null;
  target_rate: number | null; target_average: number | null;
  membership_monthly_goal: number | null; review_monthly_goal: number | null;
} | null | undefined): TvPerformanceGoal | null {
  if (!goal) return null;
  return {
    monthlySalesGoal: goal.monthly_sales_goal, targetOpportunitiesMonthly: goal.target_opportunities_monthly,
    targetRate: goal.target_rate, targetAverage: goal.target_average,
    membershipMonthlyGoal: goal.membership_monthly_goal, reviewMonthlyGoal: goal.review_monthly_goal,
    status: goal.approval_status,
  };
}
