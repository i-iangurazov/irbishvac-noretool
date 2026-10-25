import { renderToString } from "react-dom/server";
import React, { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { RevenueView } from "./campaign-revenue-view";
import snapshot from "../data/campaign-performance-august.json";
import type { CampaignPerformanceData } from "./campaign-performance-page";
vi.mock("./marketing-icon", () => ({ MarketingIcon: () => null }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: () => null,
  Bar: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const data: CampaignPerformanceData = {
  ...(snapshot as CampaignPerformanceData),
  revenueByDepartment: [
    { department: "HVAC Install", completedRevenue: 100000 },
    { department: "Plumbing", completedRevenue: 50000 },
  ],
  salesByDepartment: [{ department: "HVAC Sales", soldAmount: 80000 }],
};
const select = (name: string, value: string) =>
  act(() => {
    const e = container.querySelector<HTMLSelectElement>(
      `select[aria-label="${name}"]`,
    )!;
    e.value = value;
    e.dispatchEvent(new Event("change", { bubbles: true }));
  });
const toggle = (group: string, text: string) =>
  act(() => {
    [
      ...container.querySelectorAll<HTMLButtonElement>(
        `[aria-label="${group}"] button`,
      ),
    ]
      .find((b) => b.textContent === text)!
      .click();
  });
describe("Revenue & Sales workspace", () => {
  it("hydrates server-rendered distribution titles without replacing the page", async () => {
    act(() => root.unmount());
    container.innerHTML = renderToString(<RevenueView data={data} />);
    const errors: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(container, <RevenueView data={data} />, {
        onRecoverableError: (error) => errors.push(error),
      });
    });
    expect(errors).toEqual([]);
  });
  it("switches summary, group shares and table while keeping chart controls independent", () => {
    act(() => root.render(<RevenueView data={data} />));
    toggle("Summary metric", "Sales");
    expect(container.textContent).toContain("Total Sales");
    expect(container.querySelector("thead")?.textContent).toContain("SOAS");
    expect(
      container.querySelector(
        '[aria-label="Channel chart metric"] button[aria-pressed="true"]',
      )?.textContent,
    ).toBe("Revenue");
    toggle("Channel chart metric", "Sales");
    expect(
      container.querySelector(".revenue-chart-panel h4")?.textContent,
    ).toBe("Sales by Channel");
  });
  it("uses real department dimensions for both modes and handles absent older data", () => {
    act(() => root.render(<RevenueView data={data} />));
    select("Group distribution by", "department");
    expect(
      container.querySelector(".revenue-distribution-card")?.textContent,
    ).toContain("HVAC Install");
    toggle("Summary metric", "Sales");
    expect(
      container.querySelector(".revenue-distribution-card")?.textContent,
    ).toContain("HVAC Sales");
    act(() =>
      root.render(<RevenueView data={snapshot as CampaignPerformanceData} />),
    );
    expect(container.textContent).toContain(
      "Business unit breakdown unavailable",
    );
  });
  it("filters and sorts the table independently from the chart and switches expense scope explicitly", () => {
    act(() => root.render(<RevenueView data={data} />));
    select("Table channels", "paid");
    select("Sort channels", "return");
    expect(container.querySelector("tbody")?.textContent).not.toContain(
      "Organic",
    );
    expect(
      container.querySelector<HTMLSelectElement>(
        'select[aria-label="Chart channels"]',
      )?.value,
    ).toBe("all");
    select("Efficiency metric", "ratio");
    expect(
      container.querySelector(".revenue-efficiency")?.textContent,
    ).toContain("Recorded marketing spend / total");
  });
  it("renders empty and zero data without infinities or invented returns", () => {
    act(() =>
      root.render(
        <RevenueView
          data={{
            ...data,
            rows: [],
            actual: {
              ...data.actual,
              completedRevenue: 0,
              soldAmount: 0,
              spend: 0,
            },
            revenueByDepartment: [],
            salesByDepartment: [],
          }}
        />,
      ),
    );
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
    expect(container.textContent).toContain("No matching channels.");
  });
});
