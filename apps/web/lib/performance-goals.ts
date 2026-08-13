export type TvPerformanceGoal = {
  monthlySalesGoal: number | null;
  targetOpportunitiesMonthly: number | null;
  targetRate: number | null;
  targetAverage: number | null;
  membershipMonthlyGoal: number | null;
  reviewMonthlyGoal: number | null;
  status: "ACTIVE" | "UPDATED_GOAL_PENDING";
};

const AUGUST_2026_GOALS: Array<TvPerformanceGoal & { technician: string }> = [
  { technician: "Eduardo Loera-Gaeta", monthlySalesGoal: 45771, targetOpportunitiesMonthly: 57, targetRate: 0.78, targetAverage: 803, membershipMonthlyGoal: null, reviewMonthlyGoal: 10, status: "ACTIVE" },
  { technician: "Christian Vasquez", monthlySalesGoal: 51600, targetOpportunitiesMonthly: 43, targetRate: 0.54, targetAverage: 1200, membershipMonthlyGoal: null, reviewMonthlyGoal: 10, status: "ACTIVE" },
  { technician: "Ivan Avila", monthlySalesGoal: 44880, targetOpportunitiesMonthly: 40, targetRate: 0.87, targetAverage: 1122, membershipMonthlyGoal: null, reviewMonthlyGoal: 10, status: "ACTIVE" },
  { technician: "Jonathan Camargo", monthlySalesGoal: 54040, targetOpportunitiesMonthly: 40, targetRate: 0.71, targetAverage: 1351, membershipMonthlyGoal: null, reviewMonthlyGoal: 10, status: "ACTIVE" },
  { technician: "Azat Akynov", monthlySalesGoal: 73353, targetOpportunitiesMonthly: 49, targetRate: 0.49, targetAverage: 1497, membershipMonthlyGoal: null, reviewMonthlyGoal: 10, status: "ACTIVE" },
  { technician: "Almaz Shamsharbek", monthlySalesGoal: 20938, targetOpportunitiesMonthly: 29, targetRate: 0.81, targetAverage: 722, membershipMonthlyGoal: null, reviewMonthlyGoal: 10, status: "ACTIVE" },
  { technician: "Christian Lopez", monthlySalesGoal: 24854, targetOpportunitiesMonthly: 34, targetRate: 0.75, targetAverage: 731, membershipMonthlyGoal: null, reviewMonthlyGoal: 10, status: "ACTIVE" },
  { technician: "Ethan Peters", monthlySalesGoal: 15000, targetOpportunitiesMonthly: 25, targetRate: 0.6, targetAverage: 600, membershipMonthlyGoal: null, reviewMonthlyGoal: 10, status: "ACTIVE" },
  { technician: "Kenneth Cox", monthlySalesGoal: 34776, targetOpportunitiesMonthly: 36, targetRate: 0.69, targetAverage: 966, membershipMonthlyGoal: null, reviewMonthlyGoal: 10, status: "ACTIVE" },
  { technician: "Bekbol Kenzheev", monthlySalesGoal: null, targetOpportunitiesMonthly: null, targetRate: null, targetAverage: null, membershipMonthlyGoal: null, reviewMonthlyGoal: 10, status: "UPDATED_GOAL_PENDING" },
  { technician: "Raymond Porras", monthlySalesGoal: 728000, targetOpportunitiesMonthly: 91, targetRate: 0.4, targetAverage: 20000, membershipMonthlyGoal: 10, reviewMonthlyGoal: 5, status: "ACTIVE" },
  { technician: "Rudy-Noel Zapien", monthlySalesGoal: 510510, targetOpportunitiesMonthly: 91, targetRate: 0.33, targetAverage: 17000, membershipMonthlyGoal: 10, reviewMonthlyGoal: 5, status: "ACTIVE" },
  { technician: "Matthew Stalcup", monthlySalesGoal: 540540, targetOpportunitiesMonthly: 91, targetRate: 0.33, targetAverage: 18000, membershipMonthlyGoal: 10, reviewMonthlyGoal: 5, status: "ACTIVE" },
];

function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

const GOALS_BY_NAME = new Map(
  AUGUST_2026_GOALS.map(({ technician, ...goal }) => [normalizeName(technician), goal]),
);

export function getTvPerformanceGoal(technician: string) {
  return GOALS_BY_NAME.get(normalizeName(technician)) ?? null;
}
