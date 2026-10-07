import { describe, expect, it } from "vitest";
import { buildCsrPerformanceDashboard } from "./csr-performance";
import { buildCsrJobs, buildCsrSales, emptyCsrSupplement } from "./csr-sources";

const stamp = "2026-10-07T12:00:00Z";
const report = (fields: string[], data: unknown[][]) => ({
  fields: fields.map((name) => ({ name })),
  data,
  hasMore: false,
});
const jobs = (rows: unknown[][]) =>
  report(["BookedBy", "JobNumber", "JobType", "JobStatus"], rows);
const estimates = (rows: unknown[][]) =>
  report(
    ["ParentJobNumber", "EstimateStatus", "Subtotal", "SoldOn", "SoldBy"],
    rows,
  );

describe("CSR sold rate", () => {
  it("joins the booking cohort to later sold estimates and counts each job once for its booking CSR", () => {
    const cohort = jobs([
      ["Nina Naem", "1", "Estimate", "Completed"],
      ["Nina Naem", "1", "Estimate", "Completed"],
      ["Nina Naem", "2", "Estimate", "Scheduled"],
      ["Nina Naem", "3", "Estimate", "Canceled"],
      ["Tracie Obaokojie", "4", "Estimate", "Completed"],
    ]);
    const sales = buildCsrSales(
      cohort,
      estimates([
        ["1", "Sold", 500, "2026-10-02", "Technician"],
        ["1", "Sold", 1000, "2026-09-23", "Other employee"],
        ["1", "Sold", 500, "2026-10-02", "Technician"],
        ["2", "Open", 1000, "2026-10-02", "Technician"],
        ["3", "Dismissed", 1000, "2026-09-23", "Technician"],
        ["4", "Sold", 300, "2026-09-17", "Technician"],
        ["999", "Sold", 5000, "2026-10-02", "Nina Naeem"],
        [null, "Sold", 5000, "2026-10-02", "Nina Naeem"],
      ]),
      "2026-09-01",
      "2026-10-07",
      stamp,
    );
    expect(sales.byCsr).toEqual({ "nina naeem": 1, "tracie obaokojie": 1 });
    expect(sales.asOf).toBe("2026-10-07");
    const extra = emptyCsrSupplement("2026-09-01", "2026-09-30");
    extra.jobs = buildCsrJobs(cohort, stamp);
    extra.sales = sales;
    const result = buildCsrPerformanceDashboard(
      report(
        ["Name", "CompanyRole"],
        [
          ["Nina Naeem", "CSR"],
          ["Tracie Obaokojie", "CSR"],
          ["Nobody Booked", "CSR"],
        ],
      ),
      extra,
    );
    expect(result.rows[0]).toMatchObject({
      totalJobsBooked: 3,
      soldJobs: 1,
      soldRate: 1 / 3,
    });
    expect(result.rows[1]).toMatchObject({
      totalJobsBooked: 1,
      soldJobs: 1,
      soldRate: 1,
    });
    expect(result.rows[2]).toMatchObject({
      totalJobsBooked: 0,
      soldJobs: 0,
      soldRate: null,
    });
    expect(result.summary).toMatchObject({
      totalJobs: 4,
      soldJobs: 2,
      soldRate: 0.5,
    });
  });
  it("ignores zero/negative estimates, sales before booking range, and sales after the refresh date", () => {
    const result = buildCsrSales(
      jobs([["A", "1", "Estimate", "Completed"]]),
      estimates([
        ["1", "Sold", 0, "2026-09-10", "A"],
        ["1", "Sold", -25, "2026-09-10", "A"],
        ["1", "Sold", 100, "2026-08-31", "A"],
        ["1", "Sold", 100, "2026-10-08", "A"],
      ]),
      "2026-09-01",
      "2026-10-07",
      stamp,
    );
    expect(result.byCsr).toEqual({});
    expect(result.source.status).toBe("available");
  });
  it("does not invent zero sales when either source is missing, including older cached supplements", () => {
    const core = report(
      ["Name", "CompanyRole", "TotalJobsBooked"],
      [["A", "CSR", 5]],
    );
    const extra = emptyCsrSupplement("2026-09-01", "2026-09-30");
    delete extra.sales;
    expect(
      buildCsrPerformanceDashboard(core, extra).rows[0]?.soldRate,
    ).toBeNull();
    extra.sales = {
      source: { status: "available", updatedAt: stamp },
      byCsr: { a: 1 },
      asOf: "2026-10-07",
    };
    expect(
      buildCsrPerformanceDashboard(core, extra).summary.soldJobs,
    ).toBeNull();
  });
  it("rejects incomplete, malformed, or conflicting source data", () => {
    const cohort = jobs([["A", "1", "Estimate", "Completed"]]);
    const sold = estimates([["1", "Sold", 100, "2026-09-10", "B"]]);
    const calculate = (j: unknown, e: unknown) =>
      buildCsrSales(j, e, "2026-09-01", "2026-10-07", stamp);
    expect(() => calculate({ ...cohort, hasMore: true }, sold)).toThrow(
      "incomplete",
    );
    expect(() => calculate(cohort, { ...sold, hasMore: true })).toThrow(
      "incomplete",
    );
    expect(() => calculate(cohort, report([], []))).toThrow("missing");
    expect(() =>
      calculate(
        jobs([
          ["A", "1", "Estimate", "Completed"],
          ["B", "1", "Estimate", "Completed"],
        ]),
        sold,
      ),
    ).toThrow("Conflicting");
    expect(() =>
      calculate(cohort, estimates([["1", "Sold", null, "2026-09-10", "B"]])),
    ).toThrow("missing");
  });
});
