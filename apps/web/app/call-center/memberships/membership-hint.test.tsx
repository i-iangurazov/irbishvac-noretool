import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipHint, membershipTooltipPosition } from "./membership-hint";

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  host.style.overflow = "hidden";
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <MembershipHint>A complete explanation of this metric.</MembershipHint>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("Memberships metric help", () => {
  it("opens on keyboard focus outside a clipped card and closes on Escape without losing focus", () => {
    const trigger = host.querySelector("button")!;
    act(() => trigger.focus());
    const tooltip = document.querySelector('[role="tooltip"]')!;
    expect(tooltip.parentElement).toBe(document.body);
    expect(host.contains(tooltip)).toBe(false);
    expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.id);
    expect(tooltip.textContent).toBe("A complete explanation of this metric.");
    act(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it("remains readable when moving the pointer from the icon to its explanation", () => {
    const trigger = host.querySelector("button")!;
    act(() =>
      trigger.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
    );
    const tooltip = document.querySelector('[role="tooltip"]')!;
    act(() => {
      trigger.dispatchEvent(
        new MouseEvent("mouseout", { bubbles: true, relatedTarget: tooltip }),
      );
      tooltip.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true, relatedTarget: trigger }),
      );
      vi.advanceTimersByTime(1000);
    });
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
    act(() => {
      tooltip.dispatchEvent(
        new MouseEvent("mouseout", {
          bubbles: true,
          relatedTarget: document.body,
        }),
      );
      vi.advanceTimersByTime(150);
    });
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });
  it("keeps the full explanation inside narrow viewport edges and flips below top-edge icons", () => {
    for (const left of [0, 300]) {
      const position = membershipTooltipPosition(
        { left, right: left + 20, top: 8, bottom: 28 },
        { width: 280, height: 160 },
        { width: 320, height: 480 },
      );
      expect(position.left).toBeGreaterThanOrEqual(12);
      expect(position.left + 280).toBeLessThanOrEqual(308);
      expect(position.top).toBeGreaterThan(28);
      expect(position.top + 160).toBeLessThanOrEqual(468);
    }
  });
  it("uses the space above bottom-edge icons", () => {
    const position = membershipTooltipPosition(
      { left: 120, right: 140, top: 450, bottom: 470 },
      { width: 280, height: 160 },
      { width: 320, height: 480 },
    );
    expect(position.top + 160).toBeLessThan(450);
    expect(position.top).toBeGreaterThanOrEqual(12);
  });
});
