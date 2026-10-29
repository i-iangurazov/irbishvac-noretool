import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { KitchenReleaseMonitor } from "./kitchen-release-monitor";
const mocks = vi.hoisted(() => ({ recover: vi.fn() }));
vi.mock("../../../packages/ui/src/components/dashboard-recovery", () => ({
  requestDashboardRecovery: mocks.recover,
}));
let root: Root, host: HTMLDivElement;
const prepare = vi.fn();
const reply = (version: string) => ({
  ok: true,
  headers: new Headers({ "content-type": "application/json" }),
  json: async () => ({ version }),
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply("release-b")));
  mocks.recover.mockReset();
  prepare.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const render = (version = "release-a") =>
  act(async () =>
    root.render(
      <KitchenReleaseMonitor currentVersion={version} beforeReload={prepare} />,
    ),
  );
describe("Kitchen deployment recovery", () => {
  it("confirms a new release twice and requests exactly one reachable-page recovery", async () => {
    await render();
    expect(mocks.recover).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(prepare).toHaveBeenCalledOnce();
    expect(mocks.recover).toHaveBeenCalledOnce();
    await act(async () => vi.advanceTimersByTimeAsync(180_000));
    expect(mocks.recover).toHaveBeenCalledOnce();
  });
  it("keeps the version of the loaded document when a data/router refresh changes server props", async () => {
    await render();
    await render("release-b");
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(mocks.recover).toHaveBeenCalledOnce();
  });
  it("does not reload the current release, an offline screen or an HTML login response", async () => {
    vi.mocked(fetch).mockResolvedValue(reply("release-a") as Response);
    await render();
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(mocks.recover).not.toHaveBeenCalled();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/html" }),
    } as Response);
    await act(async () => vi.advanceTimersByTimeAsync(120_000));
    expect(mocks.recover).not.toHaveBeenCalled();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.mocked(fetch).mockClear();
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(fetch).not.toHaveBeenCalled();
  });
  it("saves playback before hourly recovery and removes listeners when unmounted", async () => {
    await render();
    act(() => window.dispatchEvent(new Event("irbis:kitchen:before-reload")));
    expect(prepare).toHaveBeenCalledOnce();
    act(() => root.render(null));
    act(() => window.dispatchEvent(new Event("irbis:kitchen:before-reload")));
    expect(prepare).toHaveBeenCalledOnce();
  });
});
