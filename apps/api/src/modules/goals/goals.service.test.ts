import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const upsert = vi.fn();
const setDefaultMonthlyGoalEntries = vi.fn();

vi.mock("@irbis/db", () => ({
  prisma: {
    goalTrackerEntry: {
      findMany,
      upsert
    }
  },
  getGoalMonthName: (monthIndex: number) =>
    [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ][monthIndex - 1] ?? null,
  setDefaultMonthlyGoalEntries
}));

vi.mock("@irbis/config", () => ({
  getConfig: () => ({
    app: {
      timezone: "America/Los_Angeles"
    }
  })
}));

describe("GoalsService", () => {
  beforeEach(() => {
    findMany.mockReset();
    upsert.mockReset();
    setDefaultMonthlyGoalEntries.mockReset();
    setDefaultMonthlyGoalEntries.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults goal list reads to the current business year instead of UTC year", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T02:00:00.000Z"));
    const { GoalsService } = await import("./goals.service");
    const service = new GoalsService();

    await service.list();

    expect(setDefaultMonthlyGoalEntries).toHaveBeenCalledWith(2025);
  });

  it("rejects invalid monthIndex values", async () => {
    const { GoalsService } = await import("./goals.service");
    const service = new GoalsService();

    await expect(
      service.upsert({
        year: 2026,
        monthIndex: 13,
        monthName: "January",
        goalAmount: 1000
      }),
    ).rejects.toThrow("monthIndex must be an integer between 1 and 12");
  });

  it("rejects mismatched monthName and monthIndex combinations", async () => {
    const { GoalsService } = await import("./goals.service");
    const service = new GoalsService();

    await expect(
      service.upsert({
        year: 2026,
        monthIndex: 2,
        monthName: "January",
        goalAmount: 1000
      }),
    ).rejects.toThrow("monthName must match monthIndex 2 (February)");
  });
});
