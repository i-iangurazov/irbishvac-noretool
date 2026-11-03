import { describe, expect, it } from "vitest";
import {
  resolveReportRequest,
  type ServiceTitanReportDefinition,
} from "@irbis/integrations";
import { buildTvRefreshJobs, buildCompanyRefreshJobs, COMPANY_TV_FAMILIES } from "./tv-refresh-jobs";
const definition = (
  family: "technicians" | "installers" | "advisors",
): ServiceTitanReportDefinition => ({
  family,
  category: "synthetic",
  reportId: "123",
  legacyTableName: "synthetic",
  defaultPreset: "mtd",
});

describe("Company-wide scheduled refresh", () => {
  it("covers all ten components with relative MTD periods, including at month rollover", () => {
    const sources = Object.fromEntries(COMPANY_TV_FAMILIES.map(family => [family, {
      family,category:"synthetic",reportId:"123",legacyTableName:"synthetic",defaultPreset:"mtd",
    }])) as Parameters<typeof buildCompanyRefreshJobs>[0];
    const jobs=buildCompanyRefreshJobs(sources);
    expect(jobs.map(job=>job.family)).toEqual([...COMPANY_TV_FAMILIES]);
    for(const job of jobs){
      expect(job.context).toEqual({preset:"mtd"});
      const request=resolveReportRequest(sources[job.family],{...job.context,timezone:"America/Los_Angeles",referenceDate:new Date("2026-11-01T09:00:00Z")});
      expect(request.range).toEqual({from:"2026-11-01",to:"2026-11-01"});
    }
    sources.bookingRate.reportId="UNRESOLVED";
    expect(buildCompanyRefreshJobs(sources).some(job=>job.family==="bookingRate")).toBe(false);
  });
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
