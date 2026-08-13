import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const findMany = vi.fn();
const findUnique = vi.fn();
const setDefaultMonthlyGoalEntries = vi.fn();

vi.mock("@irbis/db", () => ({
  DashboardFamily: {
    TECHNICIANS: "TECHNICIANS",
    INSTALLERS: "INSTALLERS",
    ADVISORS: "ADVISORS",
    CALL_CENTER_SUMMARY: "CALL_CENTER_SUMMARY",
    CALL_CENTER_BY_CSR: "CALL_CENTER_BY_CSR",
    LEADS: "LEADS",
    CAMPAIGNS: "CAMPAIGNS",
    TRENDING: "TRENDING",
    MARKETING: "MARKETING",
    CAPACITY: "CAPACITY",
    JOB_COSTING_SUMMARY: "JOB_COSTING_SUMMARY",
    REVENUE_GOALS: "REVENUE_GOALS",
    SALES_TODAY: "SALES_TODAY",
    SALES_YESTERDAY: "SALES_YESTERDAY",
    SALES_MONTHLY_PACE: "SALES_MONTHLY_PACE",
    REVENUE_MONTHLY_PACE: "REVENUE_MONTHLY_PACE",
    BOOKING_RATE: "BOOKING_RATE",
    FIELD_PRO_TECHNICIAN_ACTIVITY: "FIELD_PRO_TECHNICIAN_ACTIVITY",
    FIELD_PRO_JOB_RECORDINGS: "FIELD_PRO_JOB_RECORDINGS"
  },
  prisma: {
    rawReportSnapshot: {
      findFirst
    },
    dashboardReadModel: {
      findUnique
    },
    goalTrackerEntry: {
      findMany
    }
  },
  setDefaultMonthlyGoalEntries
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
    capacity: { family: "capacity", defaultPreset: "today" },
    jobCostingSummary: { family: "jobCostingSummary", defaultPreset: "mtd" },
    revenueGoals: { family: "revenueGoals", defaultPreset: "ytd" },
    salesToday: { family: "salesToday", defaultPreset: "today" },
    salesYesterday: { family: "salesYesterday", defaultPreset: "yesterday" },
    salesMonthlyPace: { family: "salesMonthlyPace", defaultPreset: "mtd" },
    revenueMonthlyPace: { family: "revenueMonthlyPace", defaultPreset: "mtd" },
    bookingRate: { family: "bookingRate", defaultPreset: "today" },
    fieldProTechnicianActivity: {
      family: "fieldProTechnicianActivity",
      defaultPreset: "mtd"
    },
    fieldProJobRecordings: { family: "fieldProJobRecordings", defaultPreset: "mtd" }
  }),
  resolveReportRequest: (definition: { family: string }, context?: { preset?: string; from?: string; to?: string }) => ({
    parameters: [
      { name: "From", value: context?.from ?? "2026-03-01" },
      { name: "To", value: context?.to ?? "2026-03-21" }
    ],
    range: {
      from: context?.from ?? "2026-03-01",
      to: context?.to ?? "2026-03-21"
    },
    requestHash: `${definition.family}:${context?.preset ?? "default"}:${context?.from ?? "2026-03-01"}:${context?.to ?? "2026-03-21"}`
  })
}));

vi.mock("@irbis/config", () => ({
  getConfig: () => ({
    app: { timezone: "America/Los_Angeles" }
  })
}));

describe("DashboardService", () => {
  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset();
    findUnique.mockReset();
    setDefaultMonthlyGoalEntries.mockReset();
    setDefaultMonthlyGoalEntries.mockResolvedValue([]);
  });

  it("builds technician route payloads from raw snapshots", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue({
      payloadJson: {
        fields: [
          { name: "Name" },
          { name: "TechnicianBusinessUnit" },
          { name: "CompletedRevenue" },
          { name: "TotalLeadSales" },
          { name: "SalesOpportunity" },
          { name: "ClosedOpportunities" },
          { name: "OpportunityAverageSale" },
          { name: "MembershipOpportunities" },
          { name: "MembershipsSold" }
        ],
        data: [["A", "Service", 1000, 100, 10, 5, 300, 4, 2]]
      }
    });

    const { DashboardService } = await import("./dashboard.service");
    const service = new DashboardService();
    const result = await service.getTechnicians();

    expect(result.rowsRanked[0]?.name).toBe("A");
  });

  it("returns the full advisor roster for performance coaching", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue({
      payloadJson: {
        fields: [
          { name: "Name" },
          { name: "TechnicianBusinessUnit" },
          { name: "TotalSales" },
          { name: "SalesOpportunity" },
          { name: "CloseRateRolling" }
        ],
        data: [
          ["HVAC Advisor", "HVAC Sales", 1000, 2, 0.5],
          ["Plumbing Advisor", "Plumbing Sales", 800, 2, 0.4]
        ]
      }
    });

    const { DashboardService } = await import("./dashboard.service");
    const service = new DashboardService();
    const result = await service.getPerformanceAdvisors();

    expect(result.rowsRanked.map((row) => row.name)).toEqual([
      "HVAC Advisor",
      "Plumbing Advisor"
    ]);
  });

  it("merges Field Pro activity with job recording durations", async () => {
    findUnique
      .mockResolvedValueOnce({
        payloadJson: {
          rows: [
            {
              name: "Matthew Stalcup",
              email: "mstalcup@irbishvac.com",
              businessUnit: "HVAC - Sales",
              completedJobs: 15,
              completedRevenue: 0,
              closedOpportunities: 5,
              team: "SALES TEAM",
              totalRecordings: 10,
              qualityRecordings: 8,
              qualityRecordingRate: 0.8,
              recordingCoverage: 10 / 15
            }
          ],
          totals: { completedJobs: 15, totalRecordings: 10, qualityRecordings: 8 },
          snapshotTime: "2026-07-20T12:00:00.000Z"
        }
      })
      .mockResolvedValueOnce({
        payloadJson: {
          rows: [
            {
              jobId: "132620437",
              technician: "Matthew Stalcup",
              durationMinutes: 85.77
            },
            {
              jobId: "132578823",
              technician: "Matthew Stalcup",
              durationMinutes: 74.71
            }
          ],
          snapshotTime: "2026-07-20T12:00:00.000Z"
        }
      });

    const { DashboardService } = await import("./dashboard.service");
    const service = new DashboardService();
    const result = await service.getPerformanceFieldPro({
      from: "2026-07-13",
      to: "2026-07-19"
    });

    expect(result.rows[0]).toMatchObject({
      name: "Matthew Stalcup",
      totalRecordings: 10,
      qualityRecordingRate: 0.8,
      averageRecordingMinutes: 80.24
    });
  });

  it("does not fall back to a different cached date when the exact scope is missing", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue(null);

    const enqueue = vi.fn();
    const { DashboardService } = await import("./dashboard.service");
    const service = new DashboardService({
      ensureRefreshEnqueued: enqueue
    } as never);
    const result = await service.getTechnicians({
      preset: "mtd",
      from: "2026-03-01",
      to: "2026-03-22"
    });

    expect(result.rowsRanked).toEqual([]);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("returns an empty company-wide payload when Prisma reads fail", async () => {
    findUnique.mockRejectedValue(new Error("db offline"));
    findFirst.mockRejectedValue(new Error("db offline"));
    findMany.mockRejectedValue(new Error("db offline"));
    setDefaultMonthlyGoalEntries.mockRejectedValue(new Error("db offline"));

    const { DashboardService } = await import("./dashboard.service");
    const service = new DashboardService();
    const result = await service.getCompanyWide();

    expect(result.marketing.rows).toEqual([]);
    expect(result.capacity.rows).toEqual([]);
    expect(result.goals).toEqual([]);
    expect(result.trending.months).toHaveLength(12);
  });

  it("loads goal tracker rows for the selected business year", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue(null);

    const { DashboardService } = await import("./dashboard.service");
    const service = new DashboardService();

    await service.getTrending({
      preset: "ytd",
      from: "2025-01-02",
      to: "2025-10-14"
    });

    expect(setDefaultMonthlyGoalEntries).toHaveBeenCalledWith(2025);
  });
});
