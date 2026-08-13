import { describe, expect, it } from "vitest";
import {
  ServiceTitanReportFetchError,
  isRetryableServiceTitanStatus
} from "./client";
import { buildReportParameters } from "./reports";

describe("buildReportParameters", () => {
  it("builds basic range parameters", () => {
    const parameters = buildReportParameters(
      {
        family: "technicians",
        category: "technician",
        reportId: "66109112",
        legacyTableName: "st_technician",
        defaultPreset: "mtd"
      },
      {
        from: "2026-03-01",
        to: "2026-03-20"
      },
    );

    expect(parameters[0]).toEqual({ name: "From", value: "2026-03-01" });
    expect(parameters[1]).toEqual({ name: "To", value: "2026-03-20" });
    expect(parameters.at(-1)).toEqual({ name: "IncludeInactive", value: "false" });
  });

  it("builds both date scopes for multi-template Field Pro reports", () => {
    const parameters = buildReportParameters(
      {
        family: "fieldProTechnicianActivity",
        category: "operations",
        reportId: "125959497",
        legacyTableName: "st_field_pro_technician_activity",
        defaultPreset: "mtd",
        dateParameterNames: [
          { from: "Technicians_From", to: "Technicians_To" },
          {
            from: "FieldProTechnicianRecordingPerformance_From",
            to: "FieldProTechnicianRecordingPerformance_To"
          }
        ],
        includeDefaultInactiveParameter: false
      },
      { from: "2026-07-13", to: "2026-07-19" },
    );

    expect(parameters).toEqual([
      { name: "Technicians_From", value: "2026-07-13" },
      { name: "Technicians_To", value: "2026-07-19" },
      { name: "FieldProTechnicianRecordingPerformance_From", value: "2026-07-13" },
      { name: "FieldProTechnicianRecordingPerformance_To", value: "2026-07-19" }
    ]);
  });

  it("keys fixed today-style report ranges by the selected to-date", () => {
    const parameters = buildReportParameters(
      {
        family: "bookingRate",
        category: "marketing",
        reportId: "930",
        legacyTableName: "st_booking_rate",
        defaultPreset: "today",
        rangeResolver: ({ referenceDate, timeZone }) => {
          const day = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
          }).format(referenceDate);

          return {
            from: day,
            to: day
          };
        }
      },
      {
        preset: "ytd",
        from: "2026-01-01",
        to: "2026-03-20",
        timezone: "America/Los_Angeles",
        referenceDate: new Date("2026-03-21T12:00:00.000Z")
      },
    );

    expect(parameters[0]).toEqual({ name: "From", value: "2026-03-20" });
    expect(parameters[1]).toEqual({ name: "To", value: "2026-03-20" });
  });

  it("supports month-to-date report ranges keyed by the selected to-date", () => {
    const parameters = buildReportParameters(
      {
        family: "salesMonthlyPace",
        category: "business-unit-dashboard",
        reportId: "228",
        legacyTableName: "st_sales_monthly_pace",
        defaultPreset: "mtd",
        rangeResolver: ({ context, referenceDate, timeZone }) => {
          const to =
            context?.to ??
            new Intl.DateTimeFormat("en-CA", {
              timeZone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit"
            }).format(referenceDate);

          return {
            from: `${to.slice(0, 8)}01`,
            to
          };
        }
      },
      {
        preset: "ytd",
        to: "2026-03-21",
        timezone: "America/Los_Angeles",
        referenceDate: new Date("2026-03-21T12:00:00.000Z")
      },
    );

    expect(parameters[0]).toEqual({ name: "From", value: "2026-03-01" });
    expect(parameters[1]).toEqual({ name: "To", value: "2026-03-21" });
  });
});

describe("isRetryableServiceTitanStatus", () => {
  it("classifies transient report fetch statuses as retryable", () => {
    expect(isRetryableServiceTitanStatus(408)).toBe(true);
    expect(isRetryableServiceTitanStatus(425)).toBe(true);
    expect(isRetryableServiceTitanStatus(500)).toBe(true);
    expect(isRetryableServiceTitanStatus(502)).toBe(true);
    expect(isRetryableServiceTitanStatus(503)).toBe(true);
    expect(isRetryableServiceTitanStatus(504)).toBe(true);
  });

  it("does not retry permanent client errors", () => {
    expect(isRetryableServiceTitanStatus(400)).toBe(false);
    expect(isRetryableServiceTitanStatus(401)).toBe(false);
    expect(isRetryableServiceTitanStatus(403)).toBe(false);
    expect(isRetryableServiceTitanStatus(404)).toBe(false);
  });
});

describe("ServiceTitanReportFetchError", () => {
  it("keeps retry metadata and truncates long response bodies in the message", () => {
    const body = "x".repeat(1_200);
    const error = new ServiceTitanReportFetchError({
      family: "campaigns",
      status: 500,
      body,
      retryable: true
    });

    expect(error.status).toBe(500);
    expect(error.retryable).toBe(true);
    expect(error.body).toBe(body);
    expect(error.message).toContain("ServiceTitan report fetch failed (500) campaigns");
    expect(error.message).toContain("[truncated 200 chars]");
    expect(error.message.length).toBeLessThan(body.length);
  });
});
