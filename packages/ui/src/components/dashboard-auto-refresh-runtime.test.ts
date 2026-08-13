import { describe, expect, it } from "vitest";
import {
  getBusinessClockParts,
  removeDashboardRangeParams,
  shouldRemoveDashboardRangeParams,
} from "./dashboard-auto-refresh-runtime";

describe("dashboard auto-refresh runtime helpers", () => {
  it("reads the dashboard business date in the configured time zone", () => {
    expect(
      getBusinessClockParts(
        new Date("2026-07-08T12:30:00.000Z"),
        "America/Los_Angeles",
      ),
    ).toEqual({ dateKey: "2026-07-08", hour: 5 });
  });

  it("removes stale explicit ranges from relative preset dashboard URLs", () => {
    const href =
      "https://dash.example/technicians?preset=mtd&from=2026-07-01&to=2026-07-07&tv=1&rotate=1";

    expect(shouldRemoveDashboardRangeParams(href, "2026-07-08")).toBe(true);
    expect(removeDashboardRangeParams(href)).toBe(
      "https://dash.example/technicians?preset=mtd&tv=1&rotate=1",
    );
  });

  it("keeps current and non-relative ranges alone", () => {
    expect(
      shouldRemoveDashboardRangeParams(
        "https://dash.example/technicians?preset=mtd&from=2026-07-01&to=2026-07-08&tv=1",
        "2026-07-08",
      ),
    ).toBe(false);
    expect(
      shouldRemoveDashboardRangeParams(
        "https://dash.example/technicians?preset=yesterday&from=2026-07-07&to=2026-07-07&tv=1",
        "2026-07-08",
      ),
    ).toBe(false);
  });

  it("keeps an explicitly fixed historical range", () => {
    expect(
      shouldRemoveDashboardRangeParams(
        "https://dash.example/technicians?preset=mtd&from=2026-08-01&to=2026-08-12&range=fixed&tv=1",
        "2026-08-13",
      ),
    ).toBe(false);
  });
});
