import { getConfig } from "@irbis/config";
import { DashboardFamily } from "@irbis/db";
import {
  buildAdvisorDashboard,
  buildBookingRateSummary,
  buildCallCenterDashboard,
  buildCampaignDashboard,
  buildCapacitySummary,
  buildInstallerDashboard,
  buildJobCostingSummary,
  buildLeadGenerationDashboard,
  buildMarketingDonut,
  buildRevenueGoalSummary,
  buildRevenueMonthlyPace,
  buildSalesMonthlyPace,
  buildSalesSummary,
  buildTechnicianDashboard,
  buildTrendingModel
} from "@irbis/domain";
import { type ReportFamilyKey } from "@irbis/integrations";
import { createLogger, getDateParts, getDaysInBusinessMonth } from "@irbis/utils";

const config = getConfig();
const logger = createLogger("worker-read-models");

export const DASHBOARD_FAMILY_MAP: Record<ReportFamilyKey, DashboardFamily> = {
  technicians: DashboardFamily.TECHNICIANS,
  installers: DashboardFamily.INSTALLERS,
  advisors: DashboardFamily.ADVISORS,
  callCenterByCsr: DashboardFamily.CALL_CENTER_BY_CSR,
  callCenterSummary: DashboardFamily.CALL_CENTER_SUMMARY,
  leadGeneration: DashboardFamily.LEADS,
  campaigns: DashboardFamily.CAMPAIGNS,
  trending: DashboardFamily.TRENDING,
  marketing: DashboardFamily.MARKETING,
  capacity: DashboardFamily.CAPACITY,
  jobCostingSummary: DashboardFamily.JOB_COSTING_SUMMARY,
  revenueGoals: DashboardFamily.REVENUE_GOALS,
  salesToday: DashboardFamily.SALES_TODAY,
  salesYesterday: DashboardFamily.SALES_YESTERDAY,
  salesMonthlyPace: DashboardFamily.SALES_MONTHLY_PACE,
  revenueMonthlyPace: DashboardFamily.REVENUE_MONTHLY_PACE,
  bookingRate: DashboardFamily.BOOKING_RATE
};

export function buildDashboardReadModel(family: ReportFamilyKey, payload: unknown) {
  const today = new Date();
  const businessDay = getDateParts(today, config.app.timezone).day;
  const businessWeekdayName = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: config.app.timezone
  }).format(today);

  switch (family) {
    case "technicians":
      return buildTechnicianDashboard(payload);
    case "installers":
      return buildInstallerDashboard(payload);
    case "advisors":
      return buildAdvisorDashboard(payload);
    case "callCenterByCsr":
    case "callCenterSummary":
      return buildCallCenterDashboard(payload);
    case "leadGeneration":
      return buildLeadGenerationDashboard(payload);
    case "campaigns":
      return buildCampaignDashboard(payload);
    case "marketing":
      return buildMarketingDonut(payload);
    case "capacity":
      return buildCapacitySummary(payload, {
        mode: "daily",
        currentWeekdayName: businessWeekdayName
      });
    case "jobCostingSummary":
      return buildJobCostingSummary(payload);
    case "revenueGoals":
      return buildRevenueGoalSummary(payload);
    case "salesToday":
    case "salesYesterday":
      return buildSalesSummary(payload);
    case "salesMonthlyPace":
      return buildSalesMonthlyPace(payload, {
        businessDayOfMonth: businessDay,
        daysInMonth: getDaysInBusinessMonth(today, config.app.timezone),
        fromDay: 2
      });
    case "revenueMonthlyPace":
      return buildRevenueMonthlyPace(payload);
    case "bookingRate":
      return buildBookingRateSummary(payload);
    case "trending":
      return buildTrendingModel(payload);
    default:
      logger.warn("Unhandled read-model family", { family });
      return payload;
  }
}
