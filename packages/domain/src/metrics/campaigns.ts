import { pickFirst, resolveTabularReport, toNumber, toRatio } from "../shared/report";

export type CampaignRow = {
  name: string;
  leadCalls: number;
  bookedJobsByCall: number;
  bookingRate: number | null;
  campaignLeads: number;
  totalJobsBooked: number;
  bookedJobsCancelled: number;
  campaignCost: number;
  completedRevenue: number;
  roi: number | null;
  rankByLeadCalls?: number;
};

export type CampaignDashboard = {
  rows: CampaignRow[];
  rowsRanked: CampaignRow[];
  leader: CampaignRow | null;
  snapshotTime: string | null;
};

const ALIASES = {
  name: ["Name", "Campaign Name", "Campaign", "Source", "Channel"],
  leadCalls: ["LeadCalls", "Lead Calls", "Calls"],
  bookedJobsByCall: ["BookedJobsByCall", "Booked Jobs By Call"],
  bookingRate: ["InboundBookingRate", "Inbound Booking Rate", "BookingRate"],
  campaignLeads: ["Leads", "CampaignLeads", "Campaign Leads"],
  totalJobsBooked: ["TotalJobsBooked", "Total Jobs Booked"],
  bookedJobsCancelled: ["BookedJobsCanceled", "Booked Jobs Canceled", "Booked Jobs Cancelled"],
  campaignCost: ["Cost", "Campaign Cost", "Spend", "AdSpend", "MarketingSpend"],
  completedRevenue: ["CompletedRevenue", "Completed Revenue", "Revenue"],
  roi: ["RoiRate", "ROI", "ROI %", "Roi", "ROIPercent"]
};

export function buildCampaignDashboard(input: unknown): CampaignDashboard {
  const report = resolveTabularReport(input);

  const rows = report.rows
    .map((row) => {
      const campaignCost = toNumber(pickFirst(row, ALIASES.campaignCost));
      const completedRevenue = toNumber(pickFirst(row, ALIASES.completedRevenue));
      const explicitRoi = pickFirst(row, ALIASES.roi);
      const explicitBookingRate = pickFirst(row, ALIASES.bookingRate);
      const derivedRoi =
        campaignCost > 0 && completedRevenue > 0
          ? ((completedRevenue - campaignCost) / campaignCost) * 100
          : null;

      return {
        name: String(pickFirst(row, ALIASES.name) ?? "").trim(),
        leadCalls: toNumber(pickFirst(row, ALIASES.leadCalls)),
        bookedJobsByCall: toNumber(pickFirst(row, ALIASES.bookedJobsByCall)),
        bookingRate:
          explicitBookingRate == null || explicitBookingRate === ""
            ? null
            : toRatio(explicitBookingRate),
        campaignLeads: toNumber(pickFirst(row, ALIASES.campaignLeads)),
        totalJobsBooked: toNumber(pickFirst(row, ALIASES.totalJobsBooked)),
        bookedJobsCancelled: toNumber(pickFirst(row, ALIASES.bookedJobsCancelled)),
        campaignCost,
        completedRevenue,
        roi: explicitRoi == null || explicitRoi === "" ? derivedRoi : toNumber(explicitRoi)
      };
    })
    .filter((row) => row.name !== "");

  const rowsRanked = rows
    .slice()
    .sort(
      (left, right) =>
        right.leadCalls - left.leadCalls ||
        right.completedRevenue - left.completedRevenue ||
        left.name.localeCompare(right.name),
    )
    .map((row, index) => ({ ...row, rankByLeadCalls: index + 1 }));

  return {
    rows,
    rowsRanked,
    leader: rowsRanked[0] ?? null,
    snapshotTime: report.snapshotTime
  };
}
