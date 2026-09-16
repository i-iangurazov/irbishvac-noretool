import type {
  CampaignCategory,
  CampaignPerformanceData,
  CampaignRow,
} from "../components/campaign-performance-page";

export function rowCategory(row: CampaignRow): CampaignCategory {
  if (row.category) return row.category;
  if (
    [
      "Yelp",
      "Google Ads",
      "Google Local Services",
      "Google LSA",
      "Facebook Ads",
      "Facebook",
      "Paid Social",
      "Workfuel",
      "Direct Mail",
      "Mail Shark",
      "Refer Pro",
      "Website",
    ].includes(row.channel)
  )
    return "paid";
  if (["Billboard", "Radio"].includes(row.channel)) return "separate-spend";
  if (
    [
      "669-COOLING",
      "Home Care",
      "Home Care Plan",
      "3rd Party Websites",
      "Carrier",
      "Rheem",
      "Switch Is On",
      "EnergySage",
      "CPAU",
      "GBP San Jose",
      "Existing Customers",
      "Email Marketing",
    ].includes(row.channel)
  )
    return "organic";
  if (row.channel === "Hatch Campaigns") return "automation";
  if (row.channel === "Scheduling Pro") return "retention";
  if (row.channel === "Now Operator") return "partner";
  return "other";
}

export function missingPaidSpend(row: CampaignRow) {
  const active =
    row.actual.qualifiedLeads > 0 ||
    row.actual.bookedJobs > 0 ||
    row.actual.soldJobs > 0 ||
    row.actual.completedRevenue > 0;
  return rowCategory(row) === "paid" && active && row.actual.spend === 0;
}

export function rowCommissionCost(row: CampaignRow) {
  return row.actual.commissionCost ?? 0;
}

export function rowTotalCost(row: CampaignRow) {
  return row.actual.totalCost ?? row.actual.spend + rowCommissionCost(row);
}

export function totalCommissionCost(data: CampaignPerformanceData) {
  return (
    data.actual.commissionCost ??
    data.rows.reduce((sum, row) => sum + rowCommissionCost(row), 0)
  );
}

export function totalAcquisitionCost(data: CampaignPerformanceData) {
  return data.actual.totalCost ?? data.actual.spend + totalCommissionCost(data);
}

export function spendCoverage(data: CampaignPerformanceData) {
  const activePaidRows = data.rows.filter(
    (row) =>
      rowCategory(row) === "paid" &&
      (row.actual.qualifiedLeads > 0 ||
        row.actual.bookedJobs > 0 ||
        row.actual.soldJobs > 0 ||
        row.actual.completedRevenue > 0),
  );
  const missingPaidChannels = activePaidRows
    .filter(missingPaidSpend)
    .map((row) => row.channel);
  const trackedPaidRows = activePaidRows.filter((row) => row.actual.spend > 0);
  const trackedPaidChannels = trackedPaidRows.length;
  const activePaidLeads = activePaidRows.reduce(
    (sum, row) => sum + row.actual.qualifiedLeads,
    0,
  );
  const trackedPaidLeads = trackedPaidRows.reduce(
    (sum, row) => sum + row.actual.qualifiedLeads,
    0,
  );
  const trackedPaidSpend = trackedPaidRows.reduce(
    (sum, row) => sum + row.actual.spend,
    0,
  );
  const trackedCommissionCost = trackedPaidRows.reduce(
    (sum, row) => sum + rowCommissionCost(row),
    0,
  );
  const trackedPaidTotalCost = trackedPaidSpend + trackedCommissionCost;
  const trackedPaidBookedJobs = trackedPaidRows.reduce(
    (sum, row) => sum + row.actual.bookedJobs,
    0,
  );
  const trackedPaidCompletedRevenue = trackedPaidRows.reduce(
    (sum, row) => sum + row.actual.completedRevenue,
    0,
  );
  const derived = {
    status:
      activePaidRows.length === 0
        ? ("not-applicable" as const)
        : missingPaidChannels.length === 0
          ? ("complete" as const)
          : trackedPaidChannels === 0
            ? ("unavailable" as const)
            : ("partial" as const),
    activePaidChannels: activePaidRows.length,
    trackedPaidChannels,
    missingPaidChannels,
    trackedLeadShare:
      activePaidLeads > 0 ? trackedPaidLeads / activePaidLeads : null,
    trackedPaidSpend,
    trackedCommissionCost,
    trackedPaidTotalCost,
    trackedPaidLeads,
    trackedPaidBookedJobs,
    trackedPaidCompletedRevenue,
    coveredCostPerLead:
      trackedPaidLeads > 0 ? trackedPaidTotalCost / trackedPaidLeads : null,
    coveredCostPerBookedJob:
      trackedPaidBookedJobs > 0
        ? trackedPaidTotalCost / trackedPaidBookedJobs
        : null,
    coveredRoas:
      trackedPaidTotalCost > 0
        ? trackedPaidCompletedRevenue / trackedPaidTotalCost
        : null,
  };
  return { ...derived, ...data.spendCoverage };
}

export type PerformanceMetric =
  | "qualifiedLeads"
  | "bookedJobs"
  | "completedRevenue"
  | "soldAmount";
export type ChannelSort = "completedRevenue" | "soldAmount" | "roas";

export function bookingRateFor(rows: CampaignRow[]) {
  const leads = rows.reduce((sum, row) => sum + row.actual.qualifiedLeads, 0);
  return leads > 0
    ? rows.reduce((sum, row) => sum + row.actual.bookedJobs, 0) / leads
    : null;
}

export function channelRoas(row: CampaignRow) {
  if (missingPaidSpend(row)) return null;
  const cost = rowTotalCost(row);
  return cost > 0 ? row.actual.completedRevenue / cost : null;
}

export function topChannels(
  rows: CampaignRow[],
  category: "paid" | "organic",
  sort: ChannelSort,
) {
  const value = (row: CampaignRow) =>
    sort === "roas" ? channelRoas(row) : row.actual[sort];
  return rows
    .filter((row) => rowCategory(row) === category)
    .sort(
      (a, b) =>
        (value(b) ?? -Infinity) - (value(a) ?? -Infinity) ||
        b.actual.completedRevenue - a.actual.completedRevenue ||
        a.channel.localeCompare(b.channel),
    )
    .slice(0, 3);
}

export function performanceSeries(
  history: CampaignPerformanceData[],
  metric: PerformanceMetric,
) {
  return [...history]
    .sort((a, b) => a.period.from.localeCompare(b.period.from))
    .map((period) => {
      const sum = (category: "paid" | "organic") =>
        period.rows
          .filter((row) => rowCategory(row) === category)
          .reduce((total, row) => total + row.actual[metric], 0);
      const unavailable =
        period.leadDataStatus === "unavailable" &&
        (metric === "bookedJobs" || metric === "qualifiedLeads");
      return {
        month: period.period.from.slice(0, 7),
        cutoff: period.period.to,
        snapshot: period.dataStatus !== "LIVE",
        paid: unavailable ? null : sum("paid"),
        organic: unavailable ? null : sum("organic"),
      };
    });
}

export function campaignMonthIds(
  currentMonth: string,
  requestedMonth: string,
  knownMonths: string[],
) {
  const first = [...knownMonths, currentMonth].sort()[0]!;
  const months: string[] = [];
  // Retain at most a year of chart history; an explicit older selection is also fetched.
  const end = new Date(`${currentMonth}-01T12:00:00Z`);
  for (let offset = 11; offset >= 0; offset--) {
    const date = new Date(end);
    date.setUTCMonth(date.getUTCMonth() - offset);
    const month = date.toISOString().slice(0, 7);
    if (month >= first) months.push(month);
  }
  if (
    /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) &&
    requestedMonth <= currentMonth
  )
    months.push(requestedMonth);
  return [...new Set([...months, ...knownMonths])].sort();
}
