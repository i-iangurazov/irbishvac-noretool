import { beforeEach, describe, expect, it, vi } from "vitest";
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@irbis/db", () => ({
  DashboardFamily: { CALL_CENTER_SOURCE: "CALL_CENTER_SOURCE" },
  prisma: { dashboardReadModel: { findUnique } },
}));
vi.mock("./dashboard-refresh.service", () => ({
  DashboardRefreshService: class {},
}));
import {
  MembershipDashboardController,
  membershipQueryPeriod,
} from "./membership-dashboard.controller";
import type { DashboardRefreshService } from "./dashboard-refresh.service";
import { emptyMembershipPerformance } from "@irbis/domain";
const period = { from: "2026-09-01", to: "2026-09-28" };
const enqueueMembershipRefresh = vi
  .fn()
  .mockResolvedValue({ jobId: "test", state: "waiting" });
const controller = () =>
  new MembershipDashboardController({
    enqueueMembershipRefresh,
  } as unknown as DashboardRefreshService);
beforeEach(() => {
  findUnique.mockReset();
  enqueueMembershipRefresh.mockClear();
});
describe("membership dashboard API", () => {
  it("returns pending and queues only the requested period when no snapshot exists", async () => {
    findUnique.mockResolvedValue(null);
    expect(await controller().getDashboard(period)).toEqual(
      emptyMembershipPerformance(period),
    );
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        family_scopeKey: {
          family: "CALL_CENTER_SOURCE",
          scopeKey: "membership-performance:v1:2026-09-01:2026-09-28",
        },
      },
    });
    expect(enqueueMembershipRefresh).toHaveBeenCalledWith(period);
  });
  it("returns fresh scoped data without scheduling duplicate work", async () => {
    const payload = {
      ...emptyMembershipPerformance(period),
      snapshotTime: new Date().toISOString(),
    };
    findUnique.mockResolvedValue({
      payloadJson: payload,
      snapshotTime: new Date(),
    });
    expect(await controller().getDashboard(period)).toEqual(payload);
    expect(enqueueMembershipRefresh).not.toHaveBeenCalled();
  });
  it("keeps the last snapshot visible while refreshing stale data", async () => {
    const payload = emptyMembershipPerformance(period);
    findUnique.mockResolvedValue({
      payloadJson: payload,
      snapshotTime: new Date(Date.now() - 3600000),
    });
    expect(await controller().getDashboard(period)).toEqual(payload);
    expect(enqueueMembershipRefresh).toHaveBeenCalledWith(period);
  });
  it("rejects malformed dates and presets before requesting data or refresh", async () => {
    expect(() => membershipQueryPeriod({ preset: "garbage" })).toThrow(
      "Invalid date preset",
    );
    expect(() =>
      membershipQueryPeriod({ from: "2026-09-31", to: "2026-10-01" }),
    ).toThrow("Invalid reporting date");
    expect(() => controller().requestRefresh({ from: "2026-10-01" })).toThrow(
      "Both dates",
    );
    expect(enqueueMembershipRefresh).not.toHaveBeenCalled();
  });
});
