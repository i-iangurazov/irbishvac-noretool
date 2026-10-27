import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { ChannelTable, type CampaignRow } from "./campaign-performance-page";
import snapshot from "../data/campaign-performance-august.json";
vi.mock("@irbis/ui", () => ({ DashboardShell: () => null }));
vi.mock("./marketing-icon", () => ({ MarketingIcon: () => null }));
vi.mock("./marketing-overview", () => ({ MarketingOverview: () => null }));
vi.mock("../lib/api", () => ({ navItems: [] }));
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());
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
it("uses media ROAS and exposes full expenses in clipped channel cells", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <ChannelTable rows={[workfuel]} />,
  );
  expect(container.textContent).toContain("ROAS 10.3x");
  expect(container.textContent).not.toContain("ROAS 7.1x");
  const titles = [...container.querySelectorAll("[title]")].map((e) =>
    e.getAttribute("title"),
  );
  expect(titles).toContain("$6,772.50");
  expect(titles).toContain("$3,000.00");
  expect(
    titles.some((t) => t?.includes("Total acquisition cost: $9,772.50")),
  ).toBe(true);
});
it("does not present an untracked media cost as a precise zero cost", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <ChannelTable
      rows={[{ ...workfuel, actual: { ...workfuel.actual, spend: 0 } }]}
    />,
  );
  expect(
    container
      .querySelector(".campaign-cost-missing strong")
      ?.getAttribute("title"),
  ).toContain("not tracked");
  expect(container.textContent).toContain("ROAS -");
});
