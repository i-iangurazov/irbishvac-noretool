import { describe, expect, it } from "vitest";
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

  it("supports fixed today-style report ranges", () => {
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

    expect(parameters[0]).toEqual({ name: "From", value: "2026-03-21" });
    expect(parameters[1]).toEqual({ name: "To", value: "2026-03-21" });
  });

  it("supports month-from-second report ranges keyed by the selected to-date", () => {
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
            from: `${to.slice(0, 8)}02`,
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

    expect(parameters[0]).toEqual({ name: "From", value: "2026-03-02" });
    expect(parameters[1]).toEqual({ name: "To", value: "2026-03-21" });
  });
});
