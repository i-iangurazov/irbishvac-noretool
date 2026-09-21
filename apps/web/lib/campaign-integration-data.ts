import type { CampaignPerformanceData, CampaignRow } from "../components/campaign-performance-page";
import { bookingRateFor, rowCategory, spendCoverage, topChannels, type ChannelSort } from "./campaign-overview";

function publicRow(row: CampaignRow) {
  return {
    channel: row.channel, category: rowCategory(row), budgetType: row.budgetType,
    plan: row.plan, forecast: row.forecast, effectivePlan: row.effectivePlan,
    forecastEffectiveFrom: row.forecastEffectiveFrom, forecastReason: row.forecastReason,
    actual: row.actual, leadAttainment: row.leadAttainment,
    opportunityAttainment: row.opportunityAttainment, pace: row.pace,
    budgetPace: row.budgetPace, status: row.status,
  };
}

export function campaignIntegrationReport(data: CampaignPerformanceData) {
  const coverage = spendCoverage(data);
  const complete = coverage.status === "complete";
  const leadsAvailable = data.leadDataStatus !== "unavailable";
  const rankings = Object.fromEntries((["completedRevenue", "soldAmount", "roas"] as ChannelSort[]).map((sort) => [sort, {
    paid: topChannels(data.rows, "paid", sort).map(publicRow),
    organic: topChannels(data.rows, "organic", sort).map(publicRow),
  }]));
  return {
    // Explicit business-field boundary; never forward arbitrary upstream properties.
    generatedAt: data.generatedAt, dataStatus: data.dataStatus ?? "SNAPSHOT",
    period: data.period, actual: data.actual, plan: data.plan, capacity: data.capacity,
    forecast: data.forecast, nextMonthDraft: data.nextMonthDraft, pace: data.pace,
    leadDataStatus: data.leadDataStatus ?? "available",
    revenueByDepartment: data.revenueByDepartment ?? [], spendCoverage: coverage,
    rows: data.rows.map(publicRow), alerts: data.alerts, dataNotes: data.dataNotes ?? [],
    sources: data.sources.map(({ name, role, status, refreshedAt, rowCount }) => ({ name, role, status, refreshedAt, rowCount })),
    overview: {
      completedRevenue: data.actual.completedRevenue,
      soldEstimates: data.actual.soldJobs, salesValue: data.actual.soldAmount,
      qualifiedLeads: leadsAvailable ? data.actual.qualifiedLeads : null,
      bookedJobs: leadsAvailable ? data.actual.bookedJobs : null,
      bookingRate: {
        total: leadsAvailable ? data.actual.bookingRate : null,
        paid: leadsAvailable ? bookingRateFor(data.rows.filter((row) => rowCategory(row) === "paid")) : null,
        organic: leadsAvailable ? bookingRateFor(data.rows.filter((row) => rowCategory(row) === "organic")) : null,
      },
      roas: (complete ? data.actual.roas : coverage.coveredRoas) ?? null,
      costPerLead: (complete ? data.actual.costPerLead : coverage.coveredCostPerLead) ?? null,
      costPerBookedAppointment: (complete ? data.actual.costPerBookedJob : coverage.coveredCostPerBookedJob) ?? null,
      marketingSpend: data.actual.spend, marketingBudget: data.plan.marketingBudgetGoal,
      topChannels: rankings,
    },
  };
}
