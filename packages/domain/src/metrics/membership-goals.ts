import type { MembershipDepartment } from "./membership-performance";

/**
 * Conversion plan approved with the IRBIS Membership Conversion Goals
 * (July–December 2026) document shared by membership leadership.
 *
 * These are planning inputs, not observed facts: they define the targets the
 * dashboards measure against. Every number below is copied from that document
 * so the goal math is reviewable against the source.
 */

export const MEMBERSHIP_COMPANY_GOAL = {
  /** "1,000 members by December 31" — Section: Company Goal & The Math. */
  targetMembers: 1000,
  targetDate: "2026-12-31",
  /** Active members when the plan was written (660). */
  planBaselineMembers: 660,
  /** Net gain required per month from the July baseline (~57). */
  planMonthlyNetRequired: 57,
  /** New sales per month required for 1,000 members at current renewal rates. */
  newSalesRequiredCurrentRenewal: 85,
  /** New sales per month required once renewals reach 60%. */
  newSalesRequiredSixtyPercentRenewal: 70,
} as const;

export type MembershipRenewalMilestone = {
  date: string;
  rate: number;
  label: string;
};

/** Section 5 — Renewal Goals. Current rate is 15–26%. */
export const MEMBERSHIP_RENEWAL_MILESTONES: MembershipRenewalMilestone[] = [
  { date: "2026-08-31", rate: 0.4, label: "40% by Aug 31, 2026" },
  { date: "2026-12-31", rate: 0.6, label: "60% by Q4 2026" },
];

export const MEMBERSHIP_CURRENT_RENEWAL_RANGE: [number, number] = [0.15, 0.26];

/**
 * The renewal milestone the team is currently driving toward: the next
 * milestone on or after the reporting date, or the final milestone once every
 * milestone date has passed.
 */
export function membershipRenewalTarget(asOf: string): {
  rate: number;
  label: string;
  milestone: MembershipRenewalMilestone;
  previous: MembershipRenewalMilestone | null;
} {
  const sorted = [...MEMBERSHIP_RENEWAL_MILESTONES].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const next =
    sorted.find((milestone) => milestone.date >= asOf) ??
    sorted[sorted.length - 1]!;
  const index = sorted.indexOf(next);
  return {
    rate: next.rate,
    label: next.label,
    milestone: next,
    previous: index > 0 ? sorted[index - 1]! : null,
  };
}

export type MembershipDepartmentGoal = {
  department: MembershipDepartment;
  label: string;
  opportunities: [number, number] | null;
  conversion: string;
  monthly: [number, number];
  note: string | null;
};

/**
 * Section 1 — Department Goals, mapped onto the dashboard's department
 * buckets. Ranges are the department total (all techs combined), not per tech.
 */
export const MEMBERSHIP_DEPARTMENT_GOALS: MembershipDepartmentGoal[] = [
  {
    department: "csr",
    label: "CSR (inbound + outbound)",
    opportunities: null,
    conversion: "2–3 inbound + 2–3 outbound per CSR",
    monthly: [30, 40],
    note: "Section 3: inbound 15–20/mo plus outbound list 15–20/mo across 7 CSRs, with additional renewal saves.",
  },
  {
    department: "hvac",
    label: "HVAC Service (4 techs)",
    opportunities: [120, 240],
    conversion: "10–12 per tech (~20–33% of opportunities)",
    monthly: [40, 48],
    note: null,
  },
  {
    department: "hvac-maintenance",
    label: "HVAC Maintenance (2 techs)",
    opportunities: [60, 100],
    conversion: "10–12 per tech on non-member visits",
    monthly: [20, 24],
    note: "Plus on-site renewal pitch at every expiring-member visit (renewal saves tracked separately).",
  },
  {
    department: "plumbing",
    label: "Plumbing Service (5 techs)",
    opportunities: [150, 300],
    conversion: "10–12 per tech (~17–33% of opportunities)",
    monthly: [50, 60],
    note: null,
  },
  {
    department: "other",
    label: "Install, sales & commercial",
    opportunities: [160, 240],
    conversion: "Attach goals: 40% on closed installs, 50% on water heater replacements",
    monthly: [45, 60],
    note: "HVAC Sales 24–32, water heater replacement 6–10, recalls/warranty 10–12 and commercial 5–6 agreements. Reported here as Other / unassigned.",
  },
];

/** Section: Total Monthly Plan — department total plus CSR total. */
export const MEMBERSHIP_TOTAL_MONTHLY_GOAL: [number, number] = [200, 252];
export const MEMBERSHIP_DEPARTMENT_TOTAL_GOAL: [number, number] = [155, 192];

export type MembershipTechTier = {
  tier: string;
  perTech: [number, number];
  opportunityPct: string;
  meaning: string;
};

/** Section 2 — Individual Tech Goals. */
export const MEMBERSHIP_TECH_TIERS: MembershipTechTier[] = [
  {
    tier: "Minimum standard",
    perTech: [6, 8],
    opportunityPct: "~20%",
    meaning:
      "Below this for two consecutive months triggers a coaching conversation.",
  },
  {
    tier: "Target",
    perTech: [10, 12],
    opportunityPct: "~20–33%",
    meaning: "The leaderboard number; the plan is built on this tier.",
  },
  {
    tier: "Stretch",
    perTech: [14, 18],
    opportunityPct: "~30%+",
    meaning: "Enhanced spiff tier / monthly bonus.",
  },
];

export type MembershipChannelPlan = {
  channel: string;
  current: string;
  proposed: string;
};

/** Section: Channel overview table. */
export const MEMBERSHIP_CHANNEL_PLAN: MembershipChannelPlan[] = [
  {
    channel: "Departments / techs (all field)",
    current: "~2–2.5% of opportunities",
    proposed: "~155–192 / mo",
  },
  {
    channel: "CSRs — inbound (calls/text/email)",
    current: "0–2%",
    proposed: "~15–20 / mo",
  },
  {
    channel: "CSRs — outbound (renewals + list)",
    current: "None",
    proposed: "~15–20 sales + renewal saves",
  },
  {
    channel: "Cold outreach campaigns",
    current: "One-off (0.8%)",
    proposed: "~15–20 / mo",
  },
  {
    channel: "Renewal rate",
    current: "15–26%",
    proposed: "40% by Aug 31 → 60% by Q4",
  },
];

/** Section 4 — Cold outreach / email / SMS goals. */
export const MEMBERSHIP_COLD_OUTREACH_GOAL = {
  cadence: "1 campaign per month, every month",
  segmentSize: "~2,500 customers per campaign, rotating through the 10,000 list",
  conversion: "0.6–0.8% of contacted segment",
  monthly: [15, 20] as [number, number],
};

/**
 * Attainment against a document goal range: "met" once the low end is
 * reached, "on-track" while at least 70% of the low end, otherwise "behind".
 */
export function membershipGoalStatus(
  actual: number | null,
  range: [number, number],
): "met" | "on-track" | "behind" | "unknown" {
  if (actual == null) return "unknown";
  if (actual >= range[0]) return "met";
  return actual >= range[0] * 0.7 ? "on-track" : "behind";
}
