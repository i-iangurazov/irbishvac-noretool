import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDashboardRecovery,
  type DashboardRecoveryHost,
} from "../../../packages/ui/src/components/dashboard-recovery";
let href: string, online: boolean, visible: boolean, saved: string | null;
const replace = vi.fn();
const host = (): DashboardRecoveryHost => ({
  href: () => href,
  now: () => Date.now(),
  online: () => online,
  visible: () => visible,
  replace,
  readState: () => saved,
  writeState: (value) => {
    saved = value;
  },
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-26T06:59:00Z"));
  href =
    "https://dash.example/technicians?tv=1&preset=mtd&to=2026-10-25&boards=technicians,plumbing";
  online = true;
  visible = true;
  saved = null;
  replace.mockClear();
});
afterEach(() => vi.useRealTimers());
describe("unattended TV recovery", () => {
  it("retries a hung reachability probe without reloading into a network error", async () => {
    const canRefresh = vi
      .fn()
      .mockImplementationOnce(() => new Promise<boolean>(() => {}))
      .mockResolvedValue(true);
    const c = createDashboardRecovery({ ...host(), canRefresh });
    c.recover();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(replace).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(canRefresh).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledOnce();
    c.dispose();
  });
  it("keeps recovery alive when the browser reports online but the server is unreachable", async () => {
    const canRefresh = vi.fn().mockResolvedValue(false);
    const c = createDashboardRecovery({ ...host(), canRefresh });
    c.recover();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(replace).not.toHaveBeenCalled();
    canRefresh.mockResolvedValue(true);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(replace).toHaveBeenCalledOnce();
    c.dispose();
  });
  it("does not navigate away after a successful route supersedes an in-flight probe", async () => {
    let ready: (value: boolean) => void = () => {};
    const c = createDashboardRecovery({
      ...host(),
      canRefresh: () =>
        new Promise((resolve) => {
          ready = resolve;
        }),
    });
    c.recover();
    await vi.advanceTimersByTimeAsync(5_000);
    c.markHealthy();
    ready(true);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(replace).not.toHaveBeenCalled();
    c.dispose();
  });
  it("refreshes across midnight without retaining yesterday’s relative range", async () => {
    const c = createDashboardRecovery(host());
    await vi.advanceTimersByTimeAsync(60_000);
    c.checkClock();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(replace).toHaveBeenCalledOnce();
    expect(replace.mock.calls[0]![0]).not.toContain("to=");
    expect(replace.mock.calls[0]![0]).toContain("boards=");
    c.dispose();
  });
  it("preserves explicitly fixed historical ranges and refuses external destinations", async () => {
    href += "&range=fixed";
    const c = createDashboardRecovery(host());
    c.recover("https://outside.example/");
    await vi.advanceTimersByTimeAsync(5000);
    expect(replace).toHaveBeenCalledWith(href);
    c.dispose();
  });
  it("waits through a network loss then retries automatically", async () => {
    online = false;
    const c = createDashboardRecovery(host());
    c.recover();
    await vi.advanceTimersByTimeAsync(120000);
    expect(replace).not.toHaveBeenCalled();
    online = true;
    c.onOnline();
    await vi.advanceTimersByTimeAsync(5000);
    expect(replace).toHaveBeenCalledOnce();
    c.dispose();
  });
  it("recovers on wake after an overnight hidden display", async () => {
    const c = createDashboardRecovery(host());
    visible = false;
    c.onVisible();
    await vi.advanceTimersByTimeAsync(10 * 3600000);
    visible = true;
    c.onVisible();
    await vi.advanceTimersByTimeAsync(5000);
    expect(replace).toHaveBeenCalledOnce();
    c.dispose();
  });
  it("rate limits reload failures across controller recreation, and resets after success", async () => {
    let c = createDashboardRecovery(host());
    c.recover();
    await vi.advanceTimersByTimeAsync(5000);
    c.dispose();
    replace.mockClear();
    c = createDashboardRecovery(host());
    c.recover();
    await vi.advanceTimersByTimeAsync(14999);
    expect(replace).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(replace).toHaveBeenCalledOnce();
    c.markHealthy();
    expect(saved).toBe("null");
    c.dispose();
  });
  it("bounds a hung authentication refresh and tolerates unavailable storage", async () => {
    const c = createDashboardRecovery({
      ...host(),
      beforeRefresh: () => new Promise(() => {}),
      readState: () => {
        throw Error("storage");
      },
      writeState: () => {
        throw Error("storage");
      },
    });
    c.recover();
    await vi.advanceTimersByTimeAsync(9999);
    expect(replace).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(replace).toHaveBeenCalledOnce();
    c.dispose();
  });
  it("keeps the hourly watchdog alive for 24 hours despite frequent successful route changes", async () => {
    let c = createDashboardRecovery(host());
    // A document reload creates a new root; successful SPA pages retain it.
    replace.mockImplementation((next: string) => {
      href = next;
      c.dispose();
      c = createDashboardRecovery(host());
    });
    for (let minute = 0; minute < 24 * 60; minute++) {
      for (let page = 0; page < 6; page++) {
        await vi.advanceTimersByTimeAsync(10000);
        c.markHealthy();
      }
      c.checkClock();
      // This page-ready event races with the hourly timer in a real rotating board.
      c.markHealthy();
    }
    expect(replace.mock.calls.length).toBeGreaterThanOrEqual(24);
    expect(replace.mock.calls.length).toBeLessThanOrEqual(27);
    c.dispose();
    replace.mockReset();
  });
  it("cancels recovery when disposed", async () => {
    const c = createDashboardRecovery(host());
    c.recover();
    c.dispose();
    await vi.advanceTimersByTimeAsync(60000);
    expect(replace).not.toHaveBeenCalled();
  });
});
