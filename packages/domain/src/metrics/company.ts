import { formatCompactCurrency } from "@irbis/utils";
import {
  pickFirst,
  resolveTabularReport,
  sumBy,
  toNumber
} from "../shared/report";

type MarketingRow = {
  label: string;
  value: number;
  groupKey: string;
};

export function buildMarketingDonut(
  input: unknown,
  options?: { topN?: number; metricField?: string; includeOther?: boolean },
) {
  const report = resolveTabularReport(input);
  const metricField = options?.metricField ?? "CompletedRevenue";
  const hasCategory = report.fields.some(
    (field) => field.name === "Category" || field.name === "Campaign Category",
  );
  const groupField = hasCategory ? "Category" : "Name";
  const totals = new Map<string, number>();

  for (const row of report.rows) {
    const group = String(row[groupField] ?? row["Campaign Category"] ?? row.Name ?? "Unknown");
    totals.set(group, (totals.get(group) ?? 0) + toNumber(row[metricField]));
  }

  const sorted = [...totals.entries()]
    .map(([groupKey, value]) => ({
      groupKey,
      label: `${groupKey} - ${formatCompactCurrency(value, 1)}`,
      value
    }))
    .sort((left, right) => right.value - left.value);

  const topN = options?.topN ?? 5;
  const topRows = sorted.slice(0, topN);
  const otherTotal = sumBy(sorted.slice(topN), (row) => row.value);
  const includeOther = options?.includeOther ?? false;

  const rows: MarketingRow[] =
    includeOther && otherTotal > 0
      ? [...topRows, { groupKey: "Other", label: `Other - ${formatCompactCurrency(otherTotal, 1)}`, value: otherTotal }]
      : topRows;

  return {
    rows,
    totalValue: sumBy(rows, (row) => row.value),
    snapshotTime: report.snapshotTime
  };
}

function parseRangeToHours(value: unknown): number {
  if (typeof value !== "string" || !value.includes("-")) {
    return 0;
  }

  const parts = value.split("-").map((part) => part.trim());
  if (parts.length !== 2) {
    return 0;
  }

  const [startPart, endPart] = parts as [string, string];

  const toMinutes = (input: string) => {
    const match = input.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) {
      return 0;
    }

    let hour = Number(match[1]) % 12;
    const minute = Number(match[2]);
    const meridiem = match[3];
    if (!meridiem) {
      return 0;
    }

    if (meridiem.toUpperCase() === "PM") {
      hour += 12;
    }

    return hour * 60 + minute;
  };

  const start = toMinutes(startPart);
  const end = toMinutes(endPart);
  const diff = (end - start) / 60;

  return diff < 0 ? diff + 24 : diff;
}

export function buildCapacitySummary(
  input: unknown,
  options?: {
    mode?: "weekly" | "daily";
    defaultTarget?: number;
    perBusinessUnitTargets?: Record<string, number>;
    currentWeekdayName?: string;
  },
) {
  const report = resolveTabularReport(input);
  const mode = options?.mode ?? "weekly";
  const defaultTarget = options?.defaultTarget ?? (mode === "daily" ? 8 : 50);
  const perBusinessUnitTargets = options?.perBusinessUnitTargets ?? {};

  const buckets = new Map<string, { hours: number; techs: Set<string> }>();
  const todayName =
    options?.currentWeekdayName ??
    new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());

  for (const row of report.rows) {
    const businessUnit = String(row.TechnicianBusinessUnit ?? "Unassigned");
    const technician = String(row.TechnicianName ?? "");
    const weeklyHours = toNumber(row.WeekTotal);
    const rangeHours =
      mode === "daily"
        ? parseRangeToHours(row[todayName])
        : weeklyHours > 0
          ? weeklyHours
          : [
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
              "Monday"
            ].reduce((total, day) => total + parseRangeToHours(row[day]), 0);

    if (mode === "daily" && rangeHours <= 0) {
      continue;
    }

    const current = buckets.get(businessUnit) ?? { hours: 0, techs: new Set<string>() };
    current.hours += rangeHours;
    current.techs.add(technician);
    buckets.set(businessUnit, current);
  }

  const rows = [...buckets.entries()]
    .map(([businessUnit, bucket]) => {
      const headcount = bucket.techs.size;
      const perTechTarget = perBusinessUnitTargets[businessUnit] ?? defaultTarget;
      const targetHours = headcount * perTechTarget;
      const ratioRaw = targetHours > 0 ? bucket.hours / targetHours : 0;
      const ratio = Math.max(0, Math.min(1, ratioRaw));

      return {
        businessUnit,
        headcount,
        scheduledHours: Number(bucket.hours.toFixed(1)),
        perTechTarget,
        targetHours,
        capacityRatio: ratio,
        capacityPct: Math.round(ratio * 100),
        blocks: Math.max(0, Math.min(10, Math.round(ratioRaw * 10))),
        todayDay: mode === "daily" ? todayName : null
      };
    })
    .sort((left, right) => left.businessUnit.localeCompare(right.businessUnit));

  const totals = {
    scheduledHours: sumBy(rows, (row) => row.scheduledHours),
    targetHours: sumBy(rows, (row) => row.targetHours),
    headcount: sumBy(rows, (row) => row.headcount),
    capacityPct: 0
  };

  totals.capacityPct =
    totals.targetHours > 0 ? Math.round((totals.scheduledHours / totals.targetHours) * 100) : 0;

  return {
    rows,
    totals,
    snapshotTime: report.snapshotTime
  };
}

export function buildBookingRateSummary(input: unknown) {
  const report = resolveTabularReport(input);

  const leads = sumBy(report.rows, (row) => toNumber(row.LeadCalls ?? row["Lead Calls"]));
  const booked = sumBy(report.rows, (row) =>
    toNumber(row.BookedJobsByCall ?? row["Booked Jobs By Call"]),
  );
  const unbooked = Math.max(leads - booked, 0);
  const rate = leads > 0 ? booked / leads : 0;

  return {
    pie: {
      labels: ["Booked", "Unbooked"],
      values: [booked, unbooked]
    },
    progress: {
      value: Number((rate * 100).toFixed(1))
    },
    centerLabel: `${(rate * 100).toFixed(1)}%`,
    kpis: {
      leads,
      booked,
      unbooked,
      rate
    },
    snapshotTime: report.snapshotTime
  };
}

export function buildRevenueMonthlyPace(input: unknown) {
  const report = resolveTabularReport(input);
  const value = sumBy(report.rows, (row) => toNumber(row.CurrentMonthlyPace));

  return {
    value,
    formatted: formatCompactCurrency(value),
    snapshotTime: report.snapshotTime
  };
}

export function buildSalesMonthlyPace(
  input: unknown,
  options?: {
    daysInMonth?: number;
    businessDayOfMonth?: number;
    fromDay?: number;
  },
) {
  const report = resolveTabularReport(input);
  const totalSalesToDate = sumBy(report.rows, (row) => toNumber(row.TotalSales));
  const daysInMonth = options?.daysInMonth ?? 30;
  const businessDayOfMonth = options?.businessDayOfMonth ?? daysInMonth;
  const fromDay = options?.fromDay ?? 2;
  const daysPast = Math.max(1, businessDayOfMonth - (fromDay - 1));
  const pace = totalSalesToDate * (daysInMonth / daysPast);

  return {
    totalSalesToDate,
    daysPast,
    daysInMonth,
    fromDay,
    pace,
    paceFormatted: formatCompactCurrency(pace),
    snapshotTime: report.snapshotTime
  };
}

export function buildRevenueGoalSummary(input: unknown) {
  const report = resolveTabularReport(input);

  const groups = report.rows.map((row) => ({
    name: String(row.Name ?? ""),
    totalRevenue: toNumber(row.TotalRevenue),
    totalSales: toNumber(row.TotalSales),
    goalDaily: toNumber(row.GoalDaily),
    goalNoWeekends: toNumber(row.GoalNoWeekends),
    yearlyPace: toNumber(row.CurrentYearlyPace),
    monthlyPace: toNumber(row.CurrentMonthlyPace),
    combinedRevenue: toNumber(row.TotalRevenue) + toNumber(row.TotalSales)
  }));

  const totals = {
    totalRevenue: sumBy(groups, (group) => group.totalRevenue),
    totalSales: sumBy(groups, (group) => group.totalSales),
    combinedRevenue: sumBy(groups, (group) => group.combinedRevenue),
    yearlyPace: sumBy(groups, (group) => group.yearlyPace),
    monthlyPace: sumBy(groups, (group) => group.monthlyPace)
  };

  const companyGoalDaily = Math.max(...groups.map((group) => group.goalDaily), 0);
  const companyGoalNoWeekends = Math.max(...groups.map((group) => group.goalNoWeekends), 0);
  const monthlyGoal = companyGoalNoWeekends || companyGoalDaily || 0;
  const yearlyGoal = monthlyGoal * 12;
  const yearTotalRevenue = totals.totalRevenue;
  const monthTotalRevenue = totals.combinedRevenue;
  const looksYtd = monthlyGoal > 0 && yearTotalRevenue > monthlyGoal * 1.5;
  const pctMonth = monthlyGoal > 0 ? Math.min(1, monthTotalRevenue / monthlyGoal) : 0;
  const pctYear = yearlyGoal > 0 ? Math.min(1, yearTotalRevenue / yearlyGoal) : 0;

  return {
    groups,
    totals: {
      ...totals,
      companyGoalDaily,
      companyGoalNoWeekends,
      monthlyGoal,
      yearlyGoal
    },
    monthTotalRevenue,
    yearTotalRevenue,
    pct: looksYtd ? pctYear : pctMonth,
    pctMonth,
    pctYear,
    forecastedYear: Math.max(totals.yearlyPace, totals.monthlyPace * 12),
    snapshotTime: report.snapshotTime
  };
}

export function buildSalesSummary(input: unknown) {
  const report = resolveTabularReport(input);

  const groups = report.rows.map((row) => {
    const totalSales = toNumber(row.TotalSales);
    const closeRate = toNumber(row.CloseRate);
    const opportunities = toNumber(row.SalesOpportunity);
    const closedAverageSale = toNumber(row.ClosedAverageSale);
    const closedCount = opportunities * closeRate;

    return {
      name: String(row.Name ?? ""),
      totalSales,
      totalRevenue: toNumber(row.TotalRevenue),
      nonJobRevenue: toNumber(row.NonJobRevenue),
      adjustmentRevenue: toNumber(row.AdjustmentRevenue),
      opportunities,
      closeRate,
      optionsPerOpportunity: toNumber(row.OptionsPerOpportunity),
      closedAverageSale,
      closedCount,
      expectedRevenue: opportunities * closeRate * closedAverageSale
    };
  });

  const totals = {
    totalSales: sumBy(groups, (group) => group.totalSales),
    totalRevenue: sumBy(groups, (group) => group.totalRevenue),
    nonJobRevenue: sumBy(groups, (group) => group.nonJobRevenue),
    adjustmentRevenue: sumBy(groups, (group) => group.adjustmentRevenue),
    opportunities: sumBy(groups, (group) => group.opportunities),
    closedCount: sumBy(groups, (group) => group.closedCount),
    expectedRevenue: sumBy(groups, (group) => group.expectedRevenue)
  };

  const weightedCloseRate =
    totals.opportunities > 0
      ? groups.reduce((total, group) => total + group.closeRate * group.opportunities, 0) /
        totals.opportunities
      : 0;

  return {
    groups,
    totals: {
      ...totals,
      weightedCloseRate
    },
    value: totals.totalRevenue,
    max: Math.max(totals.expectedRevenue, 0),
    pct: totals.expectedRevenue > 0 ? Math.min(1, totals.totalRevenue / totals.expectedRevenue) : 0,
    snapshotTime: report.snapshotTime
  };
}

export function buildJobCostingSummary(input: unknown, monthlyGoal = 500_000) {
  const report = resolveTabularReport(input);
  const rows = report.rows;

  const monthToDate = sumBy(rows, (row) =>
    toNumber(
      pickFirst(row, ["GrossMargin", "GrossMarginDollars", "TotalGrossMargin", "CompletedRevenue"]),
    ),
  );

  return {
    goal: monthlyGoal,
    mtd: monthToDate,
    remainingToGoal: Math.max(monthlyGoal - monthToDate, 0),
    percentToGoal: monthlyGoal > 0 ? Math.min(1, monthToDate / monthlyGoal) : 0,
    snapshotTime: report.snapshotTime
  };
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

function normalizeMonth(value: unknown): (typeof MONTHS)[number] | null {
  const stringValue = String(value ?? "").trim();
  const shortToFull: Record<string, (typeof MONTHS)[number]> = {
    Jan: "January",
    Feb: "February",
    Mar: "March",
    Apr: "April",
    May: "May",
    Jun: "June",
    Jul: "July",
    Aug: "August",
    Sep: "September",
    Sept: "September",
    Oct: "October",
    Nov: "November",
    Dec: "December"
  };

  const numeric = Number(stringValue);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) {
    return MONTHS[numeric - 1] ?? null;
  }

  const short = stringValue.slice(0, 3);
  const shortMatch = shortToFull[short as keyof typeof shortToFull];
  if (shortMatch) {
    return shortMatch;
  }

  return MONTHS.find((month) => month.toLowerCase() === stringValue.toLowerCase()) ?? null;
}

export function buildTrendingModel(
  trendingInput: unknown,
  goals: Array<{ monthName: string; goalAmount: number }> = [],
  options?: { currentYear?: number },
) {
  const report = resolveTabularReport(trendingInput);

  const goalByMonth = Object.fromEntries(
    goals.map((goal) => [goal.monthName, goal.goalAmount]),
  );

  const byYear: Record<string, Record<string, { sales: number; revenue: number }>> = {};

  for (const row of report.rows) {
    const month = normalizeMonth(row.Period);
    if (!month) {
      continue;
    }

    const year = String(row.Year ?? "");
    if (!byYear[year]) {
      byYear[year] = {};
    }

    byYear[year][month] = {
      sales: toNumber(row.TotalSales),
      revenue: toNumber(row.TotalRevenue)
    };
  }

  const yearsInData = Object.keys(byYear)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  const fallbackCurrentYear = yearsInData[yearsInData.length - 1] ?? new Date().getUTCFullYear();
  const currentYear = options?.currentYear ?? fallbackCurrentYear;
  const previousYear =
    [...yearsInData].reverse().find((year) => year < currentYear) ?? currentYear - 1;

  const months = MONTHS.map((month) => ({
    month,
    short: month.slice(0, 3),
    previous: byYear[String(previousYear)]?.[month] ?? { sales: 0, revenue: 0 },
    current: byYear[String(currentYear)]?.[month] ?? { sales: 0, revenue: 0 },
    goal: goalByMonth[month] ?? 0
  }));

  const chartMax = Math.max(
    1,
    ...months.flatMap((month) => [
      month.previous.sales,
      month.previous.revenue,
      month.current.sales,
      month.current.revenue,
      month.goal
    ]),
  );

  return {
    years: {
      previous: previousYear,
      current: currentYear
    },
    months,
    chartMax,
    snapshotTime: report.snapshotTime
  };
}
