import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { ChannelTable, type CampaignRow } from "./campaign-performance-page";
import snapshot from "../data/campaign-performance-august.json";
vi.mock("@irbis/ui", () => ({ DashboardShell: () => null }));
vi.mock("./marketing-icon", () => ({ MarketingIcon: () => null }));
vi.mock("./marketing-overview", () => ({ MarketingOverview: () => null }));
vi.mock("../lib/api", () => ({ navItems: [] }));
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
const focus = (selector: string) => {
  act(() => container.querySelector<HTMLElement>(selector)!.focus());
  return document.querySelector('[role="tooltip"]')!.textContent;
};
const workfuel: CampaignRow = {
  ...(snapshot.rows[0] as CampaignRow),
  channel: "Workfuel",
  category: "paid",
  actual: {
    ...snapshot.rows[0]!.actual,
    spend: 6772.5,
    commissionCost: 3000,
    totalCost: 9772.5,
    completedRevenue: 69429.35,
    roas: 7.104563827,
  },
};
it("uses media ROAS and shows full expenses outside clipped channel cells", () => {
  act(() => root.render(<ChannelTable rows={[workfuel]} />));
  expect(container.textContent).toContain("ROAS 10.3x");
  expect(container.textContent).not.toContain("ROAS 7.1x");
  expect(focus("tbody td:nth-child(5) strong")).toBe("Media spend: $6,772.50");
  const total = focus("tbody td:nth-child(6)");
  expect(total).toContain("Commission: $3,000.00");
  expect(total).toContain("Total acquisition cost: $9,772.50");
  expect(focus("tbody td:nth-child(8) span")).toContain(
    "$69,429.35 ÷ $6,772.50",
  );
});
it("does not present an untracked media cost as a precise zero cost", () => {
  act(() =>
    root.render(
      <ChannelTable
        rows={[{ ...workfuel, actual: { ...workfuel.actual, spend: 0 } }]}
      />,
    ),
  );
  expect(focus(".campaign-cost-missing strong")).toContain("not tracked");
  expect(focus("tbody td:nth-child(6)")).toContain(
    "Incomplete — media spend missing",
  );
  expect(container.textContent).toContain("ROAS -");
});
