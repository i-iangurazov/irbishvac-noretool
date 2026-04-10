import { describe, expect, it } from "vitest";
import {
  buildRotationHref,
  resolveDashboardFilters,
  supportsDashboardRotation
} from "./dashboard-filters";

describe("dashboard filter helpers", () => {
  it("only enables rotation on service, sales, and install boards", async () => {
    expect(supportsDashboardRotation("/technicians")).toBe(true);
    expect(supportsDashboardRotation("/advisors")).toBe(true);
    expect(supportsDashboardRotation("/installers")).toBe(true);
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
});
