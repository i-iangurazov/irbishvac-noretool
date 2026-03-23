import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const findMany = vi.fn();
const findUnique = vi.fn();

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
    BOOKING_RATE: "BOOKING_RATE"
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
  }
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
    bookingRate: { family: "bookingRate", defaultPreset: "today" }
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

  it("falls back to the latest cached read model when the exact scope is missing", async () => {
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        payloadJson: {
          rowsRanked: [
            {
              name: "Fallback Tech",
              businessUnit: "Service",
              photoUrl: null,
              totalInfluencedRevenue: 1234,
              completedRevenue: 1000,
              avgSaleFromOpps: 250,
              replacementLeadConvRate: 0.2,
              totalTechLeadSales: 300,
              totalSales: 10,
              membershipsSold: 1,
              closeRate: 0.5
            }
          ],
          totals: {
            totalInfluencedRevenue: 1234,
            completedRevenue: 1000,
            avgCloseRate: "0.5",
            avgMembershipConv: "0.25"
          }
        },
        snapshotTime: new Date("2026-03-20T00:00:00.000Z")
      });
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

    expect(result.rowsRanked[0]?.name).toBe("Fallback Tech");
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("returns an empty company-wide payload when Prisma reads fail", async () => {
    findUnique.mockRejectedValue(new Error("db offline"));
    findFirst.mockRejectedValue(new Error("db offline"));
    findMany.mockRejectedValue(new Error("db offline"));

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
    findMany.mockResolvedValue([]);

    const { DashboardService } = await import("./dashboard.service");
    const service = new DashboardService();

    await service.getTrending({
      preset: "ytd",
      from: "2025-01-02",
      to: "2025-10-14"
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          year: 2025
        }
      }),
    );
  });
});
