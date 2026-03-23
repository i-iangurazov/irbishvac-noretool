import { describe, expect, it, vi } from "vitest";

vi.mock("@irbis/config", () => ({
  getConfig: () => ({
    app: { timezone: "America/Los_Angeles" }
  })
}));

vi.mock("@irbis/integrations", () => ({
  getServiceTitanReportDefinitions: () => ({
    technicians: { family: "technicians", defaultPreset: "mtd" },
    installers: { family: "installers", defaultPreset: "mtd" },
    advisors: { family: "advisors", defaultPreset: "mtd" },
    callCenterSummary: { family: "callCenterSummary", defaultPreset: "mtd" },
    callCenterByCsr: { family: "callCenterByCsr", defaultPreset: "mtd" },
    leadGeneration: { family: "leadGeneration", defaultPreset: "mtd" },
    campaigns: { family: "campaigns", defaultPreset: "mtd" },
    trending: { family: "trending", defaultPreset: "ytd" },
    marketing: { family: "marketing", defaultPreset: "mtd" },
    capacity: { family: "capacity", defaultPreset: "today", category: "UNRESOLVED", reportId: "UNRESOLVED" },
    jobCostingSummary: { family: "jobCostingSummary", defaultPreset: "mtd", category: "operations", reportId: "111" },
    revenueGoals: { family: "revenueGoals", defaultPreset: "ytd", category: "UNRESOLVED", reportId: "UNRESOLVED" },
    salesToday: { family: "salesToday", defaultPreset: "today" },
    salesYesterday: { family: "salesYesterday", defaultPreset: "yesterday" },
    salesMonthlyPace: { family: "salesMonthlyPace", defaultPreset: "mtd" },
    revenueMonthlyPace: { family: "revenueMonthlyPace", defaultPreset: "mtd" },
    bookingRate: { family: "bookingRate", defaultPreset: "today" }
  }),
  resolveReportRequest: (definition: { family: string }, context?: { preset?: string }) => ({
    requestHash:
      definition.family === "salesToday" || definition.family === "bookingRate"
        ? `${definition.family}:today`
        : `${definition.family}:${context?.preset ?? "default"}`
  })
}));

describe("buildLatestSnapshotPlan", () => {
  it("includes both ytd and mtd for page families", async () => {
    const { buildLatestSnapshotPlan } = await import("./snapshot-plan");
    const plan = buildLatestSnapshotPlan();

    expect(plan.some((item) => item.label === "technicians:mtd")).toBe(true);
    expect(plan.some((item) => item.label === "technicians:ytd")).toBe(true);
  });

  it("dedupes families whose request hash does not change across presets", async () => {
    const { buildLatestSnapshotPlan } = await import("./snapshot-plan");
    const plan = buildLatestSnapshotPlan().filter((item) => item.family === "salesToday");

    expect(plan).toHaveLength(1);
  });

  it("can skip unresolved report families for local hybrid syncs", async () => {
    const { buildLatestSnapshotPlan } = await import("./snapshot-plan");
    const plan = buildLatestSnapshotPlan({ skipUnresolved: true });

    expect(plan.some((item) => item.family === "capacity")).toBe(false);
    expect(plan.some((item) => item.family === "revenueGoals")).toBe(false);
    expect(plan.some((item) => item.family === "jobCostingSummary")).toBe(true);
  });
});
