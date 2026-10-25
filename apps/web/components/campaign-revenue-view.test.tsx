import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import { RevenueView } from "./campaign-revenue-view";
import snapshot from "../data/campaign-performance-august.json";
import type { CampaignPerformanceData } from "./campaign-performance-page";
it("switches summary and independent chart, filters table, and labels unavailable unit sales", () => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    act(() =>
      root.render(<RevenueView data={snapshot as CampaignPerformanceData} />),
    );
    const summary = container.querySelector('[aria-label="Summary metric"]')!;
    act(() =>
      (summary.querySelectorAll("button")[1] as HTMLButtonElement).click(),
    );
    expect(container.textContent).toContain("Total Sales");
    expect(container.textContent).toContain("SOAS");
    expect(
      container.querySelector(
        '[aria-label="Channel chart metric"] button[aria-pressed="true"]',
      )?.textContent,
    ).toBe("Revenue");
    const select = container.querySelector("select")!;
    act(() => {
      select.value = "department";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.textContent).toContain(
      "Sales by business unit is unavailable",
    );
    const filter = [...container.querySelectorAll("label")]
      .find((e) => e.textContent?.startsWith("Table channels"))!
      .querySelector("select")!;
    act(() => {
      filter.value = "paid";
      filter.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector("tbody")?.textContent).not.toContain(
      "Organic",
    );
  } finally {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
