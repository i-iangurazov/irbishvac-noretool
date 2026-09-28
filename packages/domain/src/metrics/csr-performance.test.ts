import { describe, expect, it } from "vitest";
import { buildCallCenterDashboard } from "./call-center";
import { buildCsrPerformanceDashboard } from "./csr-performance";
import {
  buildCsrJobs,
  buildCsrMemberships,
  buildCsrTextLeads,
  csrReportMonth,
  emptyCsrSupplement,
} from "./csr-sources";

const fields = [
  "Name",
  "CompanyRole",
  "LeadCalls",
  "InboundCallsBooked",
  "ManualCallsBooked",
  "TotalJobsBooked",
  "InboundBookingRate",
  "CanceledBeforeDispatch",
  "CancellationRate",
  "CallsTaken",
].map((name) => ({ name }));
const table = (data: unknown[][]) => ({ fields, data });
const stamp = "2026-09-28T08:00:00Z";
const jobs = (data: unknown[][]) => ({
  fields: ["BookedBy", "JobNumber", "JobType", "JobStatus"].map((name) => ({
    name,
  })),
  data,
});
const textHeaders = [
  "CSR",
  "Lead received",
  "Call/Text",
  "Opportunity",
  "Channel",
];

describe("CSR performance", () => {
  it("excludes removed staff consistently from cards, totals, breakdowns, and unmatched leads", () => {
    const payload = table([
      ["Nina Naeem", "CSR", 10, 5, 0, 5, 0.5, 0, 0, 20],
      [" ABDUL  POPAL ", "CSR", 100, 90, 0, 90, 0.9, 0, 0, 120],
    ]);
    const extra = emptyCsrSupplement("2026-09-01", "2026-09-28");
    extra.text = buildCsrTextLeads(
      [
        {
          month: "2026-09",
          values: [
            textHeaders,
            ["Nina Naeem", "9/2/2026", "Text", "Good", "Yelp"],
            ["Abdul Popal", "9/2/2026", "Text", "Good", "Website"],
            ["", "9/2/2026", "Text", "Good", "Yelp"],
          ],
        },
      ],
      extra.from,
      extra.to,
      stamp,
    );
    extra.jobs = buildCsrJobs(
      jobs([
        ["Nina Naeem", "1", "Repair", "Completed"],
        ["Abdul Popal", "2", "Maintenance", "Canceled"],
      ]),
      stamp,
    );
    extra.memberships = buildCsrMemberships(
      {
        fields: [{ name: "SoldBy" }, { name: "SoldOn" }],
        data: [["Abdul Popal", "2026-09-03"]],
      },
      extra.from,
      extra.to,
      stamp,
    );
    const result = buildCsrPerformanceDashboard(payload, extra);
    expect(result.rowsRanked.map((row) => row.name)).toEqual(["Nina Naeem"]);
    expect(result.leader?.name).toBe("Nina Naeem");
    expect(result.summary).toMatchObject({
      leadCalls: 10,
      textLeads: 1,
      totalJobs: 1,
      bookingRate: 0.5,
      cancelledJobs: 0,
      membershipsSold: 0,
    });
    expect(result.textSources).toEqual([{ name: "Yelp", count: 1 }]);
    expect(result.jobsByType).toEqual([{ name: "Repair", count: 1 }]);
    expect(result.unassignedTextLeads).toBe(1);
    expect(buildCallCenterDashboard(payload).rows).toHaveLength(2);
  });

  it("discovers monthly reports while excluding quarterly summaries and drafts", () => {
    expect(csrReportMonth("September 2026- Call Center Report")).toBe(
      "2026-09",
    );
    expect(csrReportMonth("January - Call Center Report", "Q1 - 2026")).toBe(
      "2026-01",
    );
    expect(csrReportMonth("Quarterly Report - Q2 2026")).toBeNull();
    expect(csrReportMonth("Draft- Call Center Report")).toBeNull();
  });
  it("preserves ServiceTitan's explicit job count and zero leads; weights team rates by their denominators", () => {
    const result = buildCallCenterDashboard(
      table([
        ["CSR One", "CSR", 100, 50, 10, 58, 0.5, 2, 0.1, 120],
        ["CSR Two", "CSR", 10, 10, 1, 11, 1, 1, 0.2, 15],
        ["CSR Zero", "CSR", 0, 2, 0, 0, 0.5, 0, 0, 2],
      ]),
    );
    expect(result.rows[0]?.totalJobsBooked).toBe(58);
    expect(result.rows[2]?.leadsReceived).toBe(0);
    expect(result.rows[0]?.cancellationRate).toBe(0.1);
    expect(result.summary.bookingRate).toBeCloseTo(62 / 110);
    expect(result.summary.cancellationRate).toBeCloseTo(
      (58 * 0.1 + 11 * 0.2) / 69,
    );
  });
  it("keeps only CSR staff, joins the verified Nina spelling, and never adds text bookings to ST jobs", () => {
    const extra = emptyCsrSupplement("2026-09-01", "2026-09-28");
    extra.text = buildCsrTextLeads(
      [
        {
          month: "2026-09",
          values: [
            textHeaders,
            ["Nina Naem", "9/2/2026", "Text", "Good", "Yelp"],
            ["", "9/3/2026", "Text", "Mid", "Yelp"],
          ],
        },
      ],
      extra.from,
      extra.to,
      stamp,
    );
    extra.jobs = buildCsrJobs(
      jobs([
        ["Nina Naeem", "1", "Repair", "Completed"],
        ["Nina Naeem", "2", "Repair", "Canceled"],
        ["Nina Naeem", "2", "Repair", "Canceled"],
        ["Tim Alagushov", "3", "Repair", "Completed"],
      ]),
      stamp,
    );
    extra.memberships = buildCsrMemberships(
      {
        fields: [{ name: "SoldBy" }, { name: "SoldOn" }],
        data: [
          ["Nina Naeem", "2026-09-03"],
          ["Nina Naeem", "2026-08-30"],
        ],
      },
      extra.from,
      extra.to,
      stamp,
    );
    const result = buildCsrPerformanceDashboard(
      table([
        ["Nina Naeem", "CSR", 10, 5, 3, 8, 0.5, 0, 0, 20],
        ["Tim Alagushov", "Admin", 1, 1, 0, 1, 1, 0, 0, 2],
        ["Abandoned", null, 4, 0, 0, 0, 0, 0, 0, 9],
      ]),
      extra,
    );
    expect(result.rowsRanked.map((row) => row.name)).toEqual(["Nina Naeem"]);
    expect(result.summary).toMatchObject({
      leadCalls: 10,
      textLeads: 1,
      totalLeads: 11,
      totalJobs: 2,
      cancelledJobs: 1,
      cancellationRate: 0.5,
      membershipsSold: 1,
      missedCalls: 9,
    });
    expect(result.rows[0]?.missedCalls).toBeNull();
    expect(result.textSources).toEqual([{ name: "Yelp", count: 1 }]);
    expect(result.unassignedTextLeads).toBe(1);
    expect(result.jobsByType).toEqual([{ name: "Repair", count: 2 }]);
  });
  it("filters sheet rows by medium, quality and inclusive business dates; reads only the Master Sheet", () => {
    const result = buildCsrTextLeads(
      [
        {
          month: "2026-09",
          values: [
            textHeaders,
            ["A", "9/1/2026 00:01", "Text", "Good", "Yelp"],
            ["A", "9/28/2026 23:59", "Form", "Mid", "Website"],
            ["A", "9/29/2026", "Text", "Good", "Yelp"],
            ["A", "8/31/2026", "Text", "Good", "Yelp"],
            ["A", "9/1/2026", "Call", "Good", "Yelp"],
            ["A", "9/1/2026", "Text", "Spam", "Yelp"],
            ["A", "9/1/2026", "Text", "Not Lead", "Yelp"],
          ],
        },
      ],
      "2026-09-01",
      "2026-09-28",
      stamp,
    );
    expect(result.byCsr.a).toBe(2);
    expect(result.source.status).toBe("available");
  });
  it("recognizes January's legacy header labels without treating them as lead rows", () => {
    const result = buildCsrTextLeads(
      [
        {
          month: "2026-01",
          values: [
            [
              "CSR Tracie Obaokojie Tracie Obaokojie",
              "Lead received  ",
              "Call/Text Text Text",
              "Opportunity Not Lead Not Lead",
              "Channel Yelp San Jose Yelp San Jose",
            ],
            [
              "Tracie Obaokojie",
              "1/1/2026 12:59:00",
              "Text",
              "Mid",
              "Yelp San Jose",
            ],
          ],
        },
      ],
      "2026-01-01",
      "2026-01-31",
      stamp,
    );
    expect(result.source.status).toBe("available");
    expect(result.byCsr["tracie obaokojie"]).toBe(1);
  });
  it("does not display partial-month coverage as a complete YTD text count", () => {
    const extra = emptyCsrSupplement("2026-01-01", "2026-09-28");
    extra.text = buildCsrTextLeads(
      [
        {
          month: "2026-09",
          values: [textHeaders, ["CSR", "9/1/2026", "Text", "Good", "Yelp"]],
        },
      ],
      extra.from,
      extra.to,
      stamp,
    );
    const result = buildCsrPerformanceDashboard(
      table([["CSR", "CSR", 10, 5, 0, 5, 0.5, 0, 0, 10]]),
      extra,
    );
    expect(result.sources.text.status).toBe("partial");
    expect(result.sources.text.missingMonths).toHaveLength(8);
    expect(result.summary.textLeads).toBeNull();
    expect(result.rows[0]?.textLeads).toBeNull();
    expect(result.textSources).toEqual([]);
  });
  it("distinguishes no sales from an unavailable source and rejects truncated reports", () => {
    const payload = table([["CSR", "CSR", 1, 1, 0, 1, 1, 0, 0, 1]]);
    expect(
      buildCsrPerformanceDashboard(payload).rows[0]?.membershipsSold,
    ).toBeNull();
    const extra = emptyCsrSupplement("2026-09-01", "2026-09-28");
    extra.memberships = buildCsrMemberships(
      { fields: [{ name: "SoldBy" }, { name: "SoldOn" }], data: [] },
      extra.from,
      extra.to,
      stamp,
    );
    expect(
      buildCsrPerformanceDashboard(payload, extra).rows[0]?.membershipsSold,
    ).toBe(0);
    expect(() => buildCsrJobs({ ...jobs([]), hasMore: true }, stamp)).toThrow(
      "incomplete",
    );
    expect(() => buildCsrJobs({ fields: [], data: [] }, stamp)).toThrow(
      "missing",
    );
    const missing = buildCsrTextLeads(
      [{ month: "2026-09", values: [["Bad header"]] }],
      extra.from,
      extra.to,
      stamp,
    );
    expect(missing.source.status).toBe("unavailable");
  });
});
