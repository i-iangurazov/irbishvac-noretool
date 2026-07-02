import { describe, expect, it, vi } from "vitest";

vi.mock("@irbis/config", () => ({
  getConfig: () => ({
    app: { timezone: "America/Los_Angeles" }
  })
}));

import { buildDashboardReadModel } from "./read-models";

describe("buildDashboardReadModel", () => {
  it("uses the snapshot business date when calculating sales monthly pace", () => {
    const result = buildDashboardReadModel(
      "salesMonthlyPace",
      {
        fields: [{ name: "Name" }, { name: "TotalSales" }],
        data: [["Company", 2200]]
      },
      { businessDate: new Date("2026-06-22T00:00:00.000Z") },
    ) as { daysPast: number; daysInMonth: number; pace: number };

    expect(result.daysPast).toBe(22);
    expect(result.daysInMonth).toBe(30);
    expect(result.pace).toBe(3000);
  });
});
