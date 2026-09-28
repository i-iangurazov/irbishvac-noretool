import { buildCallCenterDashboard, type CallCenterRow } from "./call-center";
import {
  csrIdentity,
  emptyCsrSupplement,
  sumCsrValues,
  type CsrSupplement,
} from "./csr-sources";
import {
  pickFirst,
  resolveTabularReport,
  sumBy,
  toNumber,
  weightedAverage,
} from "../shared/report";

export type CsrPerformanceRow = CallCenterRow & {
  textLeads: number | null;
  totalLeads: number | null;
  cancelledJobs: number | null;
  missedCalls: number | null;
  membershipsSold: number | null;
};

// Removed from the CSR dashboard roster at the team's request. Source reports remain intact.
const excludedCsrNames = new Set(["abdul popal"]);

export function buildCsrPerformanceDashboard(
  payload: unknown,
  supplement?: CsrSupplement,
) {
  const core = buildCallCenterDashboard(payload);
  const extras =
    supplement ??
    (payload as { csrSupplement?: CsrSupplement } | null)?.csrSupplement ??
    emptyCsrSupplement("", "");
  const textAvailable = extras.text.source.status === "available";
  const jobsAvailable = extras.jobs.source.status === "available";
  const membershipsAvailable = extras.memberships.source.status === "available";
  const roster = core.rows.filter(
    (row) =>
      csrIdentity(row.name) !== "abandoned" &&
      !excludedCsrNames.has(csrIdentity(row.name)) &&
      (!row.role ||
        /\bcsr\b|customer\s+(service|care)|member.*manager/i.test(row.role) ||
        csrIdentity(row.name) === "adele aldyrakhmanova" ||
        Object.hasOwn(extras.text.byCsr, csrIdentity(row.name))),
  );
  const names = new Set(roster.map((row) => csrIdentity(row.name)));
  const rows: CsrPerformanceRow[] = roster.map((row) => {
    const name = csrIdentity(row.name);
    const jobs = extras.jobs.byCsr[name];
    const totalJobsBooked = jobsAvailable
      ? (jobs?.booked ?? 0)
      : row.totalJobsBooked;
    const cancelledJobs = jobsAvailable ? (jobs?.cancelled ?? 0) : null;
    const textLeads = textAvailable ? (extras.text.byCsr[name] ?? 0) : null;
    return {
      ...row,
      totalJobsBooked,
      cancelledJobs,
      cancellationRate:
        cancelledJobs !== null
          ? totalJobsBooked
            ? cancelledJobs / totalJobsBooked
            : 0
          : row.cancellationRate,
      callBookingRate: row.leadsReceived
        ? row.inboundCallsBooked / row.leadsReceived
        : 0,
      textLeads,
      totalLeads: textLeads === null ? null : row.leadsReceived + textLeads,
      missedCalls: null,
      membershipsSold: membershipsAvailable
        ? (extras.memberships.byCsr[name] ?? 0)
        : null,
    };
  });
  const rowsRanked = rows
    .slice()
    .sort(
      (a, b) =>
        b.callBookingRate - a.callBookingRate ||
        b.totalJobsBooked - a.totalJobsBooked ||
        a.name.localeCompare(b.name),
    )
    .map((row, i) => ({ ...row, rankByLeadCalls: i + 1 }));
  const leadCalls = sumBy(rows, (row) => row.leadsReceived);
  const inboundBooked = sumBy(rows, (row) => row.inboundCallsBooked);
  const totalJobs = sumBy(rows, (row) => row.totalJobsBooked);
  const textLeads = textAvailable
    ? sumBy(rows, (row) => row.textLeads ?? 0)
    : null;
  const cancelledJobs = jobsAvailable
    ? sumBy(rows, (row) => row.cancelledJobs ?? 0)
    : null;
  const missed = resolveTabularReport(payload).rows.find(
    (row) =>
      csrIdentity(pickFirst(row, ["Name", "CSR", "Employee"])) === "abandoned",
  );
  const missedValue = missed
    ? pickFirst(missed, ["CallsTaken", "TotalCalls", "InboundCalls"])
    : null;
  const types: Record<string, number> = {};
  if (jobsAvailable)
    for (const name of names)
      for (const [type, count] of Object.entries(
        extras.jobs.byCsr[name]?.byType ?? {},
      ))
        types[type] = (types[type] ?? 0) + count;
  const sortedCounts = (counts: Record<string, number>) =>
    Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    version: 2 as const,
    rows,
    rowsRanked,
    leader: rowsRanked[0] ?? null,
    summary: {
      leadCalls,
      textLeads,
      totalLeads: textLeads === null ? null : leadCalls + textLeads,
      inboundBooked,
      manualBooked: sumBy(rows, (row) => row.manualCallsBooked),
      totalJobs,
      bookingRate: leadCalls ? inboundBooked / leadCalls : 0,
      cancelledBeforeDispatch: sumBy(
        rows,
        (row) => row.cancelledBeforeDispatch,
      ),
      cancelledJobs,
      cancellationRate:
        cancelledJobs !== null
          ? totalJobs
            ? cancelledJobs / totalJobs
            : 0
          : weightedAverage(
              rows,
              (row) => row.cancellationRate,
              (row) => row.totalJobsBooked,
            ),
      membershipsSold: membershipsAvailable
        ? sumBy(rows, (row) => row.membershipsSold ?? 0)
        : null,
      missedCalls: missedValue === null ? null : toNumber(missedValue),
    },
    textSources: textAvailable
      ? sortedCounts(
          Object.fromEntries(
            Object.entries(extras.text.byChannel).map(([channel, counts]) => [
              channel,
              sumCsrValues(counts, names),
            ]),
          ),
        )
      : [],
    jobsByType: sortedCounts(types),
    sources: {
      text: extras.text.source,
      jobs: extras.jobs.source,
      memberships: extras.memberships.source,
    },
    unassignedTextLeads: textAvailable
      ? sumBy(Object.entries(extras.text.byCsr), ([name, count]) =>
          !names.has(name) && !excludedCsrNames.has(name) ? count : 0,
        )
      : null,
    snapshotTime: core.snapshotTime,
  };
}
export type CsrPerformanceDashboard = ReturnType<
  typeof buildCsrPerformanceDashboard
>;
