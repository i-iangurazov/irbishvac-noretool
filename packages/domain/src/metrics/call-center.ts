import { pickFirst, resolveTabularReport, sumBy, toNumber, toRatio } from "../shared/report";

export type CallCenterRow = {
  name: string;
  role: string | null;
  leadsReceived: number;
  inboundCallsBooked: number;
  manualCallsBooked: number;
  totalJobsBooked: number;
  callBookingRate: number;
  cancelledBeforeDispatch: number;
  cancellationRate: number;
  rankByLeadCalls?: number;
};

export type CallCenterResult = {
  rows: CallCenterRow[];
  rowsRanked: CallCenterRow[];
  leader: CallCenterRow | null;
  summary: {
    leadCalls: number;
    inboundBooked: number;
    manualBooked: number;
    totalJobs: number;
    bookingRate: number;
    cancelledBeforeDispatch: number;
    cancellationRate: number;
  };
  snapshotTime: string | null;
};

const ALIASES = {
  name: ["Name", "CSR", "Employee", "Agent", "TechnicianName"],
  role: ["Role", "Position", "JobTitle", "CompanyRole"],
  leadsReceived: ["LeadsReceived", "LeadCalls", "Lead Calls"],
  inboundCallsBooked: ["InboundCallsBooked", "BookedJobsByCall", "Inbound Booked"],
  manualCallsBooked: ["ManualCallsBooked", "Manual Booked"],
  totalJobsBooked: ["TotalJobsBooked", "Total Jobs Booked"],
  callBookingRate: ["CallBookingRate", "InboundBookingRate", "BookingRate"],
  cancelledBeforeDispatch: [
    "CancelledBeforeDispatch",
    "CanceledBeforeDispatch",
    "BookedJobsCanceled",
    "Booked Jobs Canceled"
  ],
  cancellationRate: ["CancellationRate", "Cancellation %", "CancellationPct"]
};

export function buildCallCenterDashboard(input: unknown): CallCenterResult {
  const report = resolveTabularReport(input);

  const rows = report.rows
    .map((row) => {
      const inboundCallsBooked = toNumber(pickFirst(row, ALIASES.inboundCallsBooked));
      const manualCallsBooked = toNumber(pickFirst(row, ALIASES.manualCallsBooked));
      // The exported Retool transformer derives total jobs from inbound + manual.
      const totalJobsBooked = inboundCallsBooked + manualCallsBooked;
      const callBookingRate = toRatio(pickFirst(row, ALIASES.callBookingRate));
      const explicitLeads = toNumber(pickFirst(row, ALIASES.leadsReceived));
      const leadsReceived =
        explicitLeads || (inboundCallsBooked > 0 && callBookingRate > 0
          ? Math.round(inboundCallsBooked / callBookingRate)
          : 0);
      const cancelledBeforeDispatch = toNumber(
        pickFirst(row, ALIASES.cancelledBeforeDispatch),
      );
      const explicitCancellationRate = pickFirst(row, ALIASES.cancellationRate);

      return {
        name: String(pickFirst(row, ALIASES.name) ?? "").trim(),
        role: (pickFirst(row, ALIASES.role) as string | null) ?? null,
        leadsReceived,
        inboundCallsBooked,
        manualCallsBooked,
        totalJobsBooked,
        callBookingRate,
        cancelledBeforeDispatch,
        cancellationRate:
          explicitCancellationRate == null || explicitCancellationRate === ""
            ? totalJobsBooked > 0
              ? cancelledBeforeDispatch / totalJobsBooked
              : 0
            : totalJobsBooked > 0
              ? cancelledBeforeDispatch / totalJobsBooked
              : toRatio(explicitCancellationRate)
      };
    })
    .filter((row) => row.name !== "");

  const rowsRanked = rows
    .slice()
    .sort(
      (left, right) =>
        right.callBookingRate - left.callBookingRate ||
        right.totalJobsBooked - left.totalJobsBooked ||
        left.name.localeCompare(right.name),
    )
    .map((row, index) => ({ ...row, rankByLeadCalls: index + 1 }));

  const summaryRows = rows.filter((row) => row.name.trim().toLowerCase() !== "abandoned");
  const averageNonZero = (values: number[]) => {
    const nonZero = values.filter((value) => Number.isFinite(value) && value !== 0);
    if (nonZero.length === 0) {
      return 0;
    }

    return sumBy(nonZero, (value) => value) / nonZero.length;
  };

  return {
    rows,
    rowsRanked,
    leader: rowsRanked[0] ?? null,
    summary: {
      leadCalls: sumBy(summaryRows, (row) => row.leadsReceived),
      inboundBooked: sumBy(summaryRows, (row) => row.inboundCallsBooked),
      manualBooked: sumBy(summaryRows, (row) => row.manualCallsBooked),
      totalJobs: sumBy(summaryRows, (row) => row.totalJobsBooked),
      bookingRate: averageNonZero(summaryRows.map((row) => row.callBookingRate)),
      cancelledBeforeDispatch: sumBy(summaryRows, (row) => row.cancelledBeforeDispatch),
      cancellationRate: averageNonZero(summaryRows.map((row) => row.cancellationRate))
    },
    snapshotTime: report.snapshotTime
  };
}
