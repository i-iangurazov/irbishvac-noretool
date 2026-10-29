import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { DashboardTvRuntime } from "./dashboard-tv-runtime";
import { DASHBOARD_RECOVERY_EVENT } from "../../../packages/ui/src/components/dashboard-recovery";
const state = vi.hoisted(() => ({
  tv: true,
  pathname: "/company-wide",
  recoveryEnabled: false,
  refresh: vi.fn(),
}));
const router = { refresh: state.refresh };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(state.tv ? "tv=1" : ""),
  usePathname: () => state.pathname,
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: vi.fn() }),
}));
vi.mock("@irbis/ui", () => ({
  DashboardAutoRefreshRuntime: ({ enabled }: { enabled: boolean }) => {
    state.recoveryEnabled = enabled;
    return null;
  },
}));
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  state.tv = true;
  state.pathname = "/company-wide";
  state.recoveryEnabled = false;
  state.refresh.mockReset();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
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
const render = () => act(() => root.render(<DashboardTvRuntime />));
describe("single-page TV data updates", () => {
  it("enables recovery for the ordinary Kitchen page used on the physical TV", () => {
    state.tv = false;
    state.pathname = "/kitchen";
    render();
    expect(state.recoveryEnabled).toBe(true);
  });
  it("refreshes a stationary TV view, keeping its clock across ordinary route rerenders", () => {
    render();
    act(() => vi.advanceTimersByTime(30000));
    render();
    act(() => vi.advanceTimersByTime(30000));
    expect(state.refresh).toHaveBeenCalledOnce();
    act(() => root.render(null));
    act(() => vi.advanceTimersByTime(60000));
    expect(state.refresh).toHaveBeenCalledOnce();
  });
  it("does not refresh a desktop view or an offline display", () => {
    state.tv = false;
    render();
    act(() => vi.advanceTimersByTime(60000));
    expect(state.refresh).not.toHaveBeenCalled();
    state.tv = true;
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render();
    act(() => vi.advanceTimersByTime(60000));
    expect(state.refresh).not.toHaveBeenCalled();
  });
  it("requests recovery if the client router is unavailable", () => {
    const recover = vi.fn();
    window.addEventListener(DASHBOARD_RECOVERY_EVENT, recover);
    state.refresh.mockImplementation(() => {
      throw Error("router unavailable");
    });
    render();
    act(() => vi.advanceTimersByTime(60000));
    expect(recover).toHaveBeenCalledOnce();
    window.removeEventListener(DASHBOARD_RECOVERY_EVENT, recover);
  });
});
