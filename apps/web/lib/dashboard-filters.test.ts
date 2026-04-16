import { describe, expect, it } from "vitest";
import {
  buildRotationBoardHref,
  buildRotationHref,
  getDashboardRotationNavItems,
  resolveDashboardFilters,
  supportsDashboardRotation
} from "./dashboard-filters";

describe("dashboard filter helpers", () => {
  it("only enables rotation on service, sales, and install boards", async () => {
    expect(supportsDashboardRotation("/technicians")).toBe(true);
    expect(supportsDashboardRotation("/plumbing")).toBe(true);
    expect(supportsDashboardRotation("/electrical")).toBe(true);
    expect(supportsDashboardRotation("/advisors")).toBe(true);
    expect(supportsDashboardRotation("/installers")).toBe(true);
    expect(supportsDashboardRotation("/plumbing-install")).toBe(true);
    expect(supportsDashboardRotation("/electrical-install")).toBe(true);
    expect(supportsDashboardRotation("/company-wide")).toBe(false);
    expect(supportsDashboardRotation("/campaigns")).toBe(false);

    const supported = await resolveDashboardFilters(
      { preset: "mtd", tv: "1", rotate: "1" },
      "America/Los_Angeles",
      "/technicians",
    );
    const unsupported = await resolveDashboardFilters(
      { preset: "mtd", tv: "1", rotate: "1" },
      "America/Los_Angeles",
      "/company-wide",
    );

    expect(supported.rotateMode).toBe(true);
    expect(unsupported.rotateMode).toBe(false);
  });

  it("does not add rotate params for unsupported dashboard paths", () => {
    const href = buildRotationHref(
      "/campaigns",
      {
        preset: "mtd",
        from: "2026-03-01",
        to: "2026-03-21",
        tvMode: true,
        rotateMode: true
      },
      "ytd",
      true,
    );

    expect(href).toBe("/campaigns?preset=ytd&from=2026-03-01&to=2026-03-21&tv=1");
  });

  it("parses and preserves selected TV rotation boards", async () => {
    const filters = await resolveDashboardFilters(
      { preset: "mtd", tv: "1", rotate: "1", boards: "technicians,plumbing" },
      "America/Los_Angeles",
      "/technicians",
    );
    const navItems = [
      { id: "company-wide", href: "/company-wide" },
      { id: "technicians", href: "/technicians" },
      { id: "plumbing", href: "/plumbing" },
      { id: "advisors", href: "/advisors" }
    ];

    expect(filters.rotationBoardIds).toEqual(["technicians", "plumbing"]);
    expect(getDashboardRotationNavItems(navItems, filters.rotationBoardIds).map((item) => item.href)).toEqual([
      "/technicians",
      "/plumbing"
    ]);
  });

  it("builds board-selection links without allowing an empty rotation set", () => {
    const href = buildRotationBoardHref(
      "/technicians",
      {
        preset: "mtd",
        from: "2026-03-01",
        to: "2026-03-21",
        kioskMode: true,
        rotationBoardIds: ["technicians", "plumbing"]
      },
      "plumbing",
    );
    const unchangedHref = buildRotationBoardHref(
      "/technicians",
      {
        preset: "mtd",
        from: "2026-03-01",
        to: "2026-03-21",
        kioskMode: false,
        rotationBoardIds: ["technicians"]
      },
      "technicians",
    );

    expect(href).toBe(
      "/technicians?preset=mtd&from=2026-03-01&to=2026-03-21&tv=1&rotate=1&kiosk=1&boards=technicians",
    );
    expect(unchangedHref).toBe(
      "/technicians?preset=mtd&from=2026-03-01&to=2026-03-21&tv=1&rotate=1&boards=technicians",
    );
  });
});
