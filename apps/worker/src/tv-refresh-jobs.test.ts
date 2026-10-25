import { describe, expect, it } from "vitest";
import {
  resolveReportRequest,
  type ServiceTitanReportDefinition,
} from "@irbis/integrations";
import { buildTvRefreshJobs } from "./tv-refresh-jobs";
const definition = (
  family: "technicians" | "installers" | "advisors",
): ServiceTitanReportDefinition => ({
  family,
  category: "synthetic",
  reportId: "123",
  legacyTableName: "synthetic",
  defaultPreset: "mtd",
});
const definitions = () => ({
  technicians: definition("technicians"),
  installers: definition("installers"),
  advisors: definition("advisors"),
});
describe("unattended TV data refresh", () => {
  it("resolves tomorrow's period after business midnight using the same persisted job", () => {
    for (const job of buildTvRefreshJobs(definitions())) {
      const before = resolveReportRequest(definitions()[job.family], {
        ...job.context,
        timezone: "America/Los_Angeles",
        referenceDate: new Date("2026-10-26T06:59:00Z"),
      });
      const after = resolveReportRequest(definitions()[job.family], {
        ...job.context,
        timezone: "America/Los_Angeles",
        referenceDate: new Date("2026-10-26T07:01:00Z"),
      });
      expect(before.range).toEqual({ from: "2026-10-01", to: "2026-10-25" });
      expect(after.range).toEqual({ from: "2026-10-01", to: "2026-10-26" });
      expect(after.requestHash).not.toBe(before.requestHash);
    }
  });
  it("does not schedule unresolved upstream reports", () => {
    const source = definitions();
    source.installers.reportId = "UNRESOLVED";
    source.advisors.category = "UNRESOLVED";
    expect(buildTvRefreshJobs(source).map((job) => job.family)).toEqual([
      "technicians",
    ]);
  });
});
