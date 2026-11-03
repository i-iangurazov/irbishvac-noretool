import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CompanyTrendingChart } from "./company-trending-chart";
import type { CompanyTrendingData } from "../lib/company-trending";

let container: HTMLDivElement, root: Root;
const data: CompanyTrendingData = {
  years: { previous: 2025, current: 2026 },
  months: Array.from({ length: 12 }, (_, i) => ({
    month: new Intl.DateTimeFormat("en-US", {
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, i, 1))),
    previous: { sales: 1000.25, revenue: 900.1 },
    current: { sales: i === 11 ? 0 : 25.22, revenue: i === 11 ? 0 : 10.01 },
    goal: 2_000_000,
  })),
};
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(<CompanyTrendingChart data={data} cutoff="2026-11-03" />),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it("opens real month amounts and goal on hover, outside the chart's clipping area", () => {
  const trigger = container.querySelector<HTMLElement>(
    '[data-month="November"]',
  )!;
  act(() =>
    trigger.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
  );
  const tooltip = document.querySelector('[role="tooltip"]')!;
  expect(tooltip.classList.contains("company-trend-tooltip")).toBe(true);
  expect(tooltip.textContent).toContain("2026 Sales (through Nov 3): $25.22");
  expect(tooltip.textContent).toContain("2026 Monthly goal: $2,000,000.00");
  expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.id);
  expect(container.contains(tooltip)).toBe(false);
});
it("supports focus, Escape, keyboard reopen and tapping a different month", () => {
  const trigger = container.querySelector<HTMLElement>(
    '[data-month="January"]',
  )!;
  act(() => trigger.focus());
  expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
  act(() =>
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
  act(() =>
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
  expect(document.querySelector('[role="tooltip"]')?.textContent).toContain(
    "January",
  );
  const december = container.querySelector<HTMLElement>(
    '[data-month="December"]',
  )!;
  act(() => {
    december.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    december.click();
  });
  expect(
    document.querySelector('[data-month="December"][aria-describedby]'),
  ).not.toBeNull();
  expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
  expect(document.querySelector('[role="tooltip"]')?.textContent).toContain(
    "Not started",
  );
});
