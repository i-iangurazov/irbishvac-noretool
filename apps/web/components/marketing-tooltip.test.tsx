import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MarketingTooltip } from "./marketing-tooltip";

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <MarketingTooltip
        content={
          "ROAS = $460,691.36 ÷ $62,191.14 = 7.4077×.\nCommissions are separate."
        }
        as="strong"
      >
        7.4×
      </MarketingTooltip>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("opens an accessible explanation on focus, dismisses with Escape and reopens on click", () => {
  const trigger = container.querySelector("strong")!;
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
  act(() => trigger.focus());
  const tooltip = document.querySelector('[role="tooltip"]')!;
  expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.id);
  expect(tooltip.textContent).toContain("$460,691.36 ÷ $62,191.14");
  expect(container.contains(tooltip)).toBe(false);
  act(() =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
  );
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
  act(() => trigger.click());
  expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
  act(() => trigger.blur());
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
});
it("keeps the explanation open while the pointer moves into it", () => {
  vi.useFakeTimers();
  const trigger = container.querySelector("strong")!;
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
    vi.advanceTimersByTime(200);
  });
  expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
  act(() => {
    tooltip.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    vi.advanceTimersByTime(200);
  });
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
});
