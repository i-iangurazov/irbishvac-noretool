export type PerformanceSourceKind = "technician" | "advisor";
export type PerformanceRateType = "close" | "conversion";
export type PerformancePlanStatus =
  | "ACTIVE"
  | "DRAFT"
  | "MISSING_SALES_GOAL"
  | "UPDATED_GOAL_PENDING";
export type PerformanceStatus =
  | "on-track"
  | "watch"
  | "off-track"
  | "missing-data"
  | "missing-goal";

export type PerformancePlan = {
  technicianId?: string | null;
  slug: string;
  month: string;
  approvalStatus: PerformancePlanStatus;
  department: string;
  technician: string;
  aliases: string[];
  sourceKind: PerformanceSourceKind;
  monthlySalesGoal: number | null;
  targetOpportunitiesMonthly: number | null;
  targetRate: number | null;
  targetRateType: PerformanceRateType;
  targetAverage: number | null;
  turnoverQuota: number | null;
  membershipMonthlyGoal: number | null;
  reviewMonthlyGoal?: number | null;
  workingDaysMonthly?: number | null;
  reviewNote?: string;
};

export type PerformanceActual = {
  sourceAvailable?: boolean;
  name: string;
  sourceKind: PerformanceSourceKind;
  technicianId: string | null;
  businessUnit: string | null;
  revenue: number;
  opportunities: number;
  closedOpportunities: number;
  rate: number;
  averageSale: number;
  membershipsSold: number | null;
  snapshotTime: string | null;
};

export type FieldProRecordingEvidence = {
  jobId: string;
  jobNumber: string | null;
  recordingTitle: string | null;
  durationMinutes: number | null;
};

export type FieldProTechnicianActual = {
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
  recordedJobs: FieldProRecordingEvidence[];
  snapshotTime: string | null;
};

export type PerformanceRosterRow = PerformancePlan & {
  actual: PerformanceActual | null;
  fieldPro: FieldProTechnicianActual | null;
  expectedRevenue: number | null;
  expectedOpportunities: number | null;
  goalAttainment: number | null;
  pace: number | null;
  paceGap: number | null;
  status: PerformanceStatus;
};

export type CoachingFocus = {
  title: string;
  reason: string;
  instruction: string;
  target: string;
  play: string[];
  impact: number | null;
  impactFormula: string | null;
};

export function normalizePerformanceIdentity(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeRate(value: number) {
  return value > 1 ? value / 100 : value;
}

function elapsedMonthRatio(month: string, cutoffDate: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const cutoff = new Date(`${cutoffDate}T12:00:00.000Z`);
  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 0));

  if (cutoff < monthStart) {
    return 0;
  }
  if (cutoff > monthEnd) {
    return 1;
  }

  return cutoff.getUTCDate() / monthEnd.getUTCDate();
}

function elapsedWorkingMonthRatio(
  month: string,
  cutoffDate: string,
  workingDaysMonthly: number,
) {
  const monthStart = new Date(`${month}-01T12:00:00.000Z`);
  const cutoff = new Date(`${cutoffDate}T12:00:00.000Z`);
  if (cutoff < monthStart) {
    return 0;
  }

  const monthEnd = new Date(Date.UTC(
    monthStart.getUTCFullYear(),
    monthStart.getUTCMonth() + 1,
    0,
    12,
  ));
  const effectiveCutoff = cutoff > monthEnd ? monthEnd : cutoff;
  let elapsedWorkingDays = 0;
  for (
    const day = new Date(monthStart);
    day <= effectiveCutoff;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    if (day.getUTCDay() !== 0) {
      elapsedWorkingDays += 1;
    }
  }
  return Math.min(1, elapsedWorkingDays / workingDaysMonthly);
}

function findActual(plan: PerformancePlan, actuals: PerformanceActual[]) {
  actuals = actuals.filter(actual => actual.sourceAvailable !== false);
  const acceptedNames = [plan.technician, ...plan.aliases].map(normalizePerformanceIdentity);

  if (plan.technicianId) {
    const byId = actuals.find(actual => actual.sourceKind === plan.sourceKind && actual.technicianId === plan.technicianId);
    if (byId) return byId;
  }
  return (
    actuals.find(
      (actual) =>
        actual.sourceKind === plan.sourceKind &&
        (!plan.technicianId || !actual.technicianId || actual.technicianId === plan.technicianId) &&
        acceptedNames.includes(normalizePerformanceIdentity(actual.name)),
    ) ?? null
  );
}

export function buildPerformanceRoster(
  actuals: PerformanceActual[],
  cutoffDate: string,
  plans: PerformancePlan[],
): PerformanceRosterRow[] {
  return plans.map((plan) => {
    const actual = findActual(plan, actuals);
    const elapsedRatio = plan.workingDaysMonthly
      ? elapsedWorkingMonthRatio(plan.month, cutoffDate, plan.workingDaysMonthly)
      : elapsedMonthRatio(plan.month, cutoffDate);
    const expectedRevenue =
      plan.monthlySalesGoal == null ? null : plan.monthlySalesGoal * elapsedRatio;
    const expectedOpportunities =
      plan.targetOpportunitiesMonthly == null
        ? null
        : plan.targetOpportunitiesMonthly * elapsedRatio;
    const goalAttainment =
      actual && plan.monthlySalesGoal
        ? actual.revenue / plan.monthlySalesGoal
        : null;
    const pace =
      actual && expectedRevenue && expectedRevenue > 0
        ? actual.revenue / expectedRevenue
        : null;
    const paceGap =
      actual && expectedRevenue != null
        ? actual.revenue - expectedRevenue
        : null;
    let status: PerformanceStatus;

    if (plan.monthlySalesGoal == null) {
      status = "missing-goal";
    } else if (!actual) {
      status = "missing-data";
    } else if ((pace ?? 0) >= 1) {
      status = "on-track";
    } else if ((pace ?? 0) >= 0.85) {
      status = "watch";
    } else {
      status = "off-track";
    }

    return {
      ...plan,
      fieldPro: null,
      actual: actual
        ? {
            ...actual,
            rate: normalizeRate(actual.rate)
          }
        : null,
      expectedRevenue,
      expectedOpportunities,
      goalAttainment,
      pace,
      paceGap,
      status
    };
  }).sort((left, right) => {
    const statusOrder: Record<PerformanceStatus, number> = {
      "off-track": 0,
      watch: 1,
      "missing-goal": 2,
      "missing-data": 3,
      "on-track": 4
    };

    return (
      statusOrder[left.status] - statusOrder[right.status] ||
      (left.pace ?? Number.POSITIVE_INFINITY) -
        (right.pace ?? Number.POSITIVE_INFINITY) ||
      left.technician.localeCompare(right.technician)
    );
  });
}

export function mergeFieldProIntoRoster(
  roster: PerformanceRosterRow[],
  fieldProRows: FieldProTechnicianActual[],
) {
  return roster.map((row) => {
    const acceptedNames = [row.technician, ...row.aliases].map(normalizePerformanceIdentity);
    const fieldPro =
      fieldProRows.find((actual) =>
        acceptedNames.includes(normalizePerformanceIdentity(actual.name)),
      ) ?? null;

    return {
      ...row,
      fieldPro
    };
  });
}

export function buildCoachingFocus(row: PerformanceRosterRow): CoachingFocus {
  if (!row.actual) {
    return {
      title: "Resolve the ServiceTitan identity mapping",
      reason: "The employee cannot be matched to a reliable ServiceTitan record.",
      instruction:
        "Confirm the technician ID and department before publishing performance conclusions.",
      target: "ServiceTitan source matched before the next report run",
      play: [
        "Confirm the canonical ServiceTitan technician ID.",
        "Confirm the effective department and manager.",
        "Re-run the report and verify the MTD values with the source."
      ],
      impact: null,
      impactFormula: null
    };
  }

  if (
    row.monthlySalesGoal == null ||
    row.targetOpportunitiesMonthly == null ||
    row.targetRate == null ||
    row.targetAverage == null
  ) {
    return {
      title: "Approve the monthly performance plan",
      reason: "The report is missing one or more approved targets required for pace and coaching.",
      instruction:
        "Complete the missing sales goal and dial targets before assigning a behavioral coaching goal.",
      target: "Approved plan with all Three Dials populated",
      play: [
        "Confirm the monthly sales goal.",
        "Confirm opportunity, rate, and average targets.",
        "Record the approver and effective month."
      ],
      impact: null,
      impactFormula: null
    };
  }

  const opportunityPace = row.expectedOpportunities
    ? row.actual.opportunities / row.expectedOpportunities
    : 1;
  const ratePace = row.targetRate > 0 ? row.actual.rate / row.targetRate : 1;
  const averagePace = row.targetAverage > 0 ? row.actual.averageSale / row.targetAverage : 1;
  const weakest = [
    { key: "opportunities", ratio: opportunityPace },
    { key: "rate", ratio: ratePace },
    { key: "average", ratio: averagePace }
  ].sort((left, right) => left.ratio - right.ratio)[0];

  if (weakest?.key === "rate") {
    const rateGap = Math.max(0, row.targetRate - row.actual.rate);
    const impact = rateGap * row.targetOpportunitiesMonthly * row.targetAverage;
    const rateLabel = row.targetRateType === "close" ? "close rate" : "conversion rate";

    return {
      title: `Increase ${rateLabel}`,
      reason: `The ${rateLabel} is the largest normalized gap among the Three Dials.`,
      instruction:
        "Use the discovery-to-options checklist on every opportunity and present at least three documented solutions before asking for the decision.",
      target: `${Math.round(row.actual.rate * 100)}% → ${Math.round(row.targetRate * 100)}%`,
      play: [
        "Ask three discovery questions before recommending a solution.",
        "Present at least three documented options on every opportunity.",
        "Confirm the client’s priority, then ask for the decision."
      ],
      impact,
      impactFormula: `(${Math.round(row.targetRate * 100)}% - ${Math.round(row.actual.rate * 100)}%) × ${row.targetOpportunitiesMonthly} opportunities × target average`
    };
  }

  if (weakest?.key === "opportunities") {
    return {
      title: "Recover opportunity pace",
      reason: "Opportunity volume is the largest normalized gap among the Three Dials.",
      instruction:
        "Review every assigned opportunity before the day starts and escalate schedule or dispatch blockers the same day.",
      target: `${Math.round(row.actual.opportunities)} MTD → ${row.targetOpportunitiesMonthly} monthly opportunities`,
      play: [
        "Review every assigned opportunity before the first call.",
        "Escalate cancelled, blocked, or unassigned work the same day.",
        "Record a complete outcome for every opportunity before day end."
      ],
      impact: null,
      impactFormula: null
    };
  }

  if (weakest?.key === "average") {
    const averageGap = Math.max(0, row.targetAverage - row.actual.averageSale);
    const impact = averageGap * row.actual.closedOpportunities;

    return {
      title: "Increase average sale",
      reason: "Average sale is the largest normalized gap among the Three Dials.",
      instruction:
        "Complete the full diagnostic and present good, better, and best solutions with the homeowner before narrowing the recommendation.",
      target: `$${Math.round(row.actual.averageSale).toLocaleString("en-US")} → $${Math.round(row.targetAverage).toLocaleString("en-US")}`,
      play: [
        "Complete the full diagnostic before building recommendations.",
        "Present good, better, and best solutions side by side.",
        "Explain value and tradeoffs before narrowing to price."
      ],
      impact,
      impactFormula: `average gap × ${Math.round(row.actual.closedOpportunities)} closed opportunities`
    };
  }

  return {
    title: "Maintain the Three Dials",
    reason: "All available Three Dials are currently at or above target.",
    instruction:
      "Repeat the current process on every opportunity and keep all three dials at or above target.",
    target: "All Three Dials at or above target next week",
    play: [
      "Repeat the same discovery and diagnostic process on every call.",
      "Check the Three Dials at midweek, not only after the week closes.",
      "Bring one repeatable strength to the next coaching meeting."
    ],
    impact: null,
    impactFormula: null
  };
}
