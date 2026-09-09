import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TvRotationRuntime } from "../../../packages/ui/src/components/tv-rotation-runtime";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
// Keep the router identity stable, as it is in Next.js.
const router = { replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

let root: Root;
let container: HTMLDivElement;
let wide = true;
let onChange: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockClear();
  wide = true;
  onChange = undefined;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return wide;
    },
    addEventListener: (_: string, callback: () => void) => {
      onChange = callback;
    },
    removeEventListener: vi.fn(),
  }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function render(
  overrides: Partial<React.ComponentProps<typeof TvRotationRuntime>> = {},
) {
  act(() =>
    root.render(
      <TvRotationRuntime
        activePath="/installers"
        enabled
        currentPage={1}
        pageCount={2}
        minViewportWidth={1280}
        navItems={[{ href: "/installers", label: "HVAC Install" }]}
        presetQuery="preset=mtd&tv=1&boards=installers"
        {...overrides}
      />,
    ),
  );
}

describe("TV rotation", () => {
  it("shows each page for ten seconds", () => {
    render();
    act(() => vi.advanceTimersByTime(9_999));
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(replace).toHaveBeenCalledWith(
      "/installers?preset=mtd&tv=1&boards=installers&page=2",
      { scroll: false },
    );
  });
  it("does not restart the timer when refreshed nav objects have the same routes", () => {
    render();
    act(() => vi.advanceTimersByTime(5_000));
    render();
    act(() => vi.advanceTimersByTime(5_000));
    expect(replace).toHaveBeenCalledTimes(1);
  });
  it("wraps the last page inside the selected department", () => {
    render({ currentPage: 2 });
    act(() => vi.advanceTimersByTime(10_000));
    expect(replace).toHaveBeenCalledWith(
      "/installers?preset=mtd&tv=1&boards=installers",
      { scroll: false },
    );
  });
  it("advances to the next selected board only after the last page", () => {
    render({
      currentPage: 2,
      rotateBoards: true,
      navItems: [
        { href: "/installers", label: "Install" },
        { href: "/advisors", label: "Advisors" },
      ],
    });
    act(() => vi.advanceTimersByTime(10_000));
    expect(replace.mock.calls[0]?.[0]).toContain("/advisors?");
  });
  it("does not auto-page a narrow scrolling display", () => {
    wide = false;
    render();
    act(() => vi.advanceTimersByTime(60_000));
    expect(replace).not.toHaveBeenCalled();
    wide = true;
    act(() => onChange?.());
    act(() => vi.advanceTimersByTime(10_000));
    expect(replace).toHaveBeenCalledTimes(1);
  });
  it("cancels rotation when the viewport narrows", () => {
    render();
    act(() => vi.advanceTimersByTime(5_000));
    wide = false;
    act(() => onChange?.());
    act(() => vi.advanceTimersByTime(60_000));
    expect(replace).not.toHaveBeenCalled();
  });
  it("does not rotate a single page inside one department", () => {
    render({ pageCount: 1, rotateBoards: true });
    act(() => vi.advanceTimersByTime(60_000));
    expect(replace).not.toHaveBeenCalled();
  });
  it("cleans up the pending navigation on unmount", () => {
    render();
    act(() => root.render(null));
    act(() => vi.advanceTimersByTime(60_000));
    expect(replace).not.toHaveBeenCalled();
  });
});
