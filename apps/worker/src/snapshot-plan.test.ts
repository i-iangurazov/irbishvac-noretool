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
    bookingRate: { family: "bookingRate", defaultPreset: "today" },
    fieldProTechnicianActivity: {
      family: "fieldProTechnicianActivity",
      defaultPreset: "mtd",
      category: "operations",
      reportId: "125959497"
    },
    fieldProJobRecordings: {
      family: "fieldProJobRecordings",
      defaultPreset: "mtd",
      category: "operations",
      reportId: "125959432"
    }
  }),
  resolveReportRequest: (definition: { family: string }, context?: { preset?: string; from?: string; to?: string }) => ({
    requestHash:
      definition.family === "salesToday" || definition.family === "bookingRate"
        ? `${definition.family}:today`
        : `${definition.family}:${context?.preset ?? context?.from ?? "default"}:${context?.to ?? ""}`
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

  it("adds the last completed week for both Field Pro reports", async () => {
    const { buildLatestSnapshotPlan } = await import("./snapshot-plan");
    const plan = buildLatestSnapshotPlan().filter((item) =>
      item.family.startsWith("fieldPro"),
    );

    expect(plan.map((item) => item.family)).toEqual([
      "fieldProTechnicianActivity",
      "fieldProJobRecordings"
    ]);
    expect(plan.every((item) => item.context.from && item.context.to)).toBe(true);
  });

  it("can skip unresolved report families for local hybrid syncs", async () => {
    const { buildLatestSnapshotPlan } = await import("./snapshot-plan");
    const plan = buildLatestSnapshotPlan({ skipUnresolved: true });

    expect(plan.some((item) => item.family === "capacity")).toBe(false);
    expect(plan.some((item) => item.family === "revenueGoals")).toBe(false);
    expect(plan.some((item) => item.family === "jobCostingSummary")).toBe(true);
  });
});
