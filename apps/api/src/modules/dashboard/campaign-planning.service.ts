import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { getConfig } from "@irbis/config";
import { GoogleSheetsClient } from "@irbis/integrations";

type CapacityInput = {
  type: "capacity";
  month: string;
  team: string;
  headcount: number;
  opportunitiesPerDay: number;
  planningDays: number;
  effectiveFrom: string;
  notes?: string;
  updatedBy: string;
};

type ForecastInput = {
  type: "forecast";
  month: string;
  channel: string;
  qualifiedLeads: number;
  bookedJobs: number;
  spend?: number | null;
  soldAmount?: number | null;
  completedRevenue?: number | null;
  effectiveFrom: string;
  reason: string;
  updatedBy: string;
};

type PlanInput = {
  type: "plan";
  month: string;
  channel: string;
  category: "paid" | "organic" | "retention" | "partner" | "other";
  qualifiedLeadGoal: number;
  bookedOpportunityGoal: number;
  approvedBudget?: number | null;
  soldAmountGoal?: number | null;
  revenueGoal?: number | null;
  budgetType: "platform" | "manual" | "prepaid" | "none";
  approvalStatus: "draft" | "approved";
  notes?: string;
  updatedBy: string;
};

export type CampaignPlanningInput = CapacityInput | ForecastInput | PlanInput;

const CAPACITY_HEADERS = [
  "Month",
  "Team",
  "Headcount",
  "Opportunities Per Day",
  "Planning Days",
  "Effective From",
  "Notes",
  "Updated By",
  "Updated At"
];

const FORECAST_HEADERS = [
  "Month",
  "Channel",
  "Qualified Lead Forecast",
  "Booked Opportunity Forecast",
  "Budget Forecast",
  "Sold Amount Forecast",
  "Revenue Forecast",
  "Effective From",
  "Reason",
  "Updated By",
  "Updated At"
];

const PLAN_HEADERS = [
  "Month",
  "Channel",
  "Category",
  "Qualified Lead Goal",
  "Booked Opportunity Goal",
  "Approved Budget",
  "Sold Amount Goal",
  "Revenue Goal",
  "Budget Type",
  "Status",
  "Approved By",
  "Approved At",
  "Notes",
  "Updated By",
  "Updated At"
];

function requireText(value: unknown, label: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new BadRequestException(`${label} is required`);
  return normalized;
}

function requireNumber(value: unknown, label: string, minimum = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new BadRequestException(`${label} must be at least ${minimum}`);
  }
  return parsed;
}

function optionalNumber(value: unknown) {
  if (value == null || value === "") return null;
  return requireNumber(value, "Optional numeric value");
}

function requireMonth(value: unknown) {
  const month = requireText(value, "Month");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException("Month must use YYYY-MM");
  return month;
}

function requireDate(value: unknown, label: string) {
  const date = requireText(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException(`${label} must use YYYY-MM-DD`);
  return date;
}

@Injectable()
export class CampaignPlanningService {
  private readonly sheets = new GoogleSheetsClient();
  private readonly writeToken = getConfig().auth.cookieSecret;

  assertAuthorized(token: string | undefined) {
    if (!token || token !== this.writeToken) {
      throw new UnauthorizedException("Campaign planning write is not authorized");
    }
  }

  async saveInput(raw: CampaignPlanningInput) {
    if (!this.sheets.isConfigured()) {
      throw new ServiceUnavailableException(
        `Google Sheets is not configured: ${this.sheets.getMissingConfiguration().join(", ")}`,
      );
    }

    const type = raw?.type;
    const month = requireMonth(raw?.month);
    const updatedBy = requireText(raw?.updatedBy, "Updated by");
    const updatedAt = new Date().toISOString();

    try {
      if (type === "capacity") {
        const input = raw as CapacityInput;
        await this.sheets.ensureSheet("Capacity Plan", CAPACITY_HEADERS);
        const result = await this.sheets.appendValues("Capacity Plan", [[
          month,
          requireText(input.team, "Team"),
          requireNumber(input.headcount, "Headcount"),
          requireNumber(input.opportunitiesPerDay, "Opportunities per day"),
          requireNumber(input.planningDays, "Planning days", 1),
          requireDate(input.effectiveFrom, "Effective from"),
          String(input.notes ?? "").trim(),
          updatedBy,
          updatedAt
        ]]);
        return { saved: true, type, updatedRange: result.updates?.updatedRange ?? null };
      }

      if (type === "forecast") {
        const input = raw as ForecastInput;
        await this.sheets.ensureSheet("Campaign Forecast", FORECAST_HEADERS);
        const result = await this.sheets.appendValues("Campaign Forecast", [[
          month,
          requireText(input.channel, "Channel"),
          requireNumber(input.qualifiedLeads, "Qualified leads"),
          requireNumber(input.bookedJobs, "Booked opportunities"),
          optionalNumber(input.spend),
          optionalNumber(input.soldAmount),
          optionalNumber(input.completedRevenue),
          requireDate(input.effectiveFrom, "Effective from"),
          requireText(input.reason, "Reason"),
          updatedBy,
          updatedAt
        ]]);
        return { saved: true, type, updatedRange: result.updates?.updatedRange ?? null };
      }

      if (type === "plan") {
        const input = raw as PlanInput;
        const category = requireText(input.category, "Category");
        if (!["paid", "organic", "retention", "partner", "other"].includes(category)) {
          throw new BadRequestException("Category is invalid");
        }
        const budgetType = requireText(input.budgetType, "Budget type");
        if (!["platform", "manual", "prepaid", "none"].includes(budgetType)) {
          throw new BadRequestException("Budget type is invalid");
        }
        const approvalStatus = requireText(input.approvalStatus, "Approval status");
        if (!["draft", "approved"].includes(approvalStatus)) {
          throw new BadRequestException("Approval status is invalid");
        }
        await this.sheets.ensureSheet("Campaign Plan", PLAN_HEADERS);
        const result = await this.sheets.appendValues("Campaign Plan", [[
          month,
          requireText(input.channel, "Channel"),
          category,
          requireNumber(input.qualifiedLeadGoal, "Qualified lead goal"),
          requireNumber(input.bookedOpportunityGoal, "Booked opportunity goal"),
          optionalNumber(input.approvedBudget),
          optionalNumber(input.soldAmountGoal),
          optionalNumber(input.revenueGoal),
          budgetType,
          approvalStatus,
          approvalStatus === "approved" ? updatedBy : "",
          approvalStatus === "approved" ? updatedAt : "",
          String(input.notes ?? "").trim(),
          updatedBy,
          updatedAt
        ]]);
        return { saved: true, type, updatedRange: result.updates?.updatedRange ?? null };
      }

      throw new BadRequestException("Type must be plan, capacity, or forecast");
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException(error instanceof Error ? error.message : String(error));
    }
  }

  async getWriteStatus() {
    if (!this.sheets.isConfigured()) {
      return {
        writable: false,
        reason: `Google Sheets is not configured: ${this.sheets.getMissingConfiguration().join(", ")}`
      };
    }
    return this.sheets.verifyWriteAccess();
  }
}
