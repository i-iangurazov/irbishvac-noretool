import { beforeEach, describe, expect, it, vi } from "vitest";
const { findUnique, findMany, upsert } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("@irbis/db", () => ({
  DashboardFamily: { CALL_CENTER_SOURCE: "CALL_CENTER_SOURCE" },
  prisma: { dashboardReadModel: { findUnique, findMany, upsert } },
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
  findMany.mockReset();
  upsert.mockReset();
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
          scopeKey: "membership-performance:v2:2026-09-01:2026-09-28",
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

describe("membership service notes", () => {
  const requestId = "8b905e5a-9f23-4e7e-a00c-c5f89d4acb28";
  const eventRecord = () => ({
    payloadJson: {
      ...emptyMembershipPerformance(period),
      seasons: { spring: null, fall: { events: [{ id: "123" }] } },
    },
  });
  it("requires a verified IRBIS author and rejects empty, oversized and malformed notes", async () => {
    const c = controller();
    await expect(
      c.addServiceNote("123", period, { body: "Test", requestId }),
    ).rejects.toThrow("IRBIS");
    await expect(
      c.addServiceNote(
        "123",
        period,
        { body: "Test", requestId },
        "user",
        "person@outside.com",
      ),
    ).rejects.toThrow("IRBIS");
    for (const body of [
      { body: "  ", requestId },
      { body: "x".repeat(2001), requestId },
      { body: "Test", requestId: "bad" },
    ])
      await expect(
        c.addServiceNote("123", period, body, "user", "person@irbishvac.com"),
      ).rejects.toThrow("1–2000");
    expect(upsert).not.toHaveBeenCalled();
  });
  it("requires the event to exist and does not mutate ServiceTitan or the aggregate", async () => {
    findUnique.mockResolvedValue(eventRecord());
    await expect(
      controller().addServiceNote(
        "999",
        period,
        { body: "Test", requestId },
        "user",
        "person@irbishvac.com",
      ),
    ).rejects.toThrow("not found");
    expect(upsert).not.toHaveBeenCalled();
    upsert.mockImplementation(async (args) => ({
      payloadJson: args.create.payloadJson,
    }));
    await controller().addServiceNote(
      "123",
      period,
      {
        body: " Customer requested another date. ",
        requestId,
        author: "forged@irbishvac.com",
      },
      "verified-user",
      "person@irbishvac.com",
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          family_scopeKey: {
            family: "CALL_CENTER_SOURCE",
            scopeKey: `membership-service-note:v1:123:${requestId}`,
          },
        },
        update: {},
        create: expect.objectContaining({
          payloadJson: expect.objectContaining({
            body: "Customer requested another date.",
            author: "person@irbishvac.com",
            authorId: "verified-user",
          }),
        }),
      }),
    );
  });
  it("loads only notes for the requested event, across source refreshes", async () => {
    findUnique.mockResolvedValue(eventRecord());
    findMany.mockResolvedValue([
      {
        payloadJson: {
          id: requestId,
          body: "Test",
          author: "person@irbishvac.com",
          createdAt: "2026-09-28",
        },
      },
    ]);
    expect(await controller().serviceNotes("123", period)).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          family: "CALL_CENTER_SOURCE",
          scopeKey: { startsWith: "membership-service-note:v1:123:" },
        },
        take: 100,
      }),
    );
  });
});
