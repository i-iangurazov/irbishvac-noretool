import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleSheetsClient } from "@irbis/integrations";
const mapping: Record<string,string> = {};
vi.mock("@irbis/config", () => ({ getConfig: () => ({ app: { timezone: "America/Los_Angeles" }, serviceTitan: { reports: { campaignSoldEstimates: { category: "operations", reportId: "sold" } } }, campaignPerformance: { google: { spreadsheetId: "legacy", spreadsheetIdsByMonth: mapping } }, csr: { reportsFolderId: "folder" } }) }));
vi.mock("@irbis/db", () => ({ DashboardFamily: { CALL_CENTER_BY_CSR: "CALL_CENTER_BY_CSR" }, Prisma: {}, prisma: {} }));
const headers=["CSR","Lead received","Lead Contacted","Call Made","Call/Text","Opportunity","Stage","Booked By","Request","Notes","Response Time","Channel"];
const file=(id:string,name:string,mimeType="application/vnd.google-apps.spreadsheet")=>({id,name,mimeType});
const client = () => ({
 isConfigured:()=>true,
 listFolderFiles:vi.fn(),
 getSpreadsheetMetadata:vi.fn().mockResolvedValue({sheets:[{properties:{title:"Master Sheet",gridProperties:{rowCount:20}}}]}),
 getValues:vi.fn().mockResolvedValue({values:[headers]})
});

describe("CSR monthly sources",()=>{
 it("reads later sales for a historical booking cohort using the business timezone", async()=>{
  const fetchPaginatedReport = vi.fn().mockResolvedValue({payload:{fields:["ParentJobNumber","EstimateStatus","Subtotal","SoldOn"].map(name=>({name})),data:[["1","Sold",500,"2026-10-06"]]}});
  const booking = {payload:{fields:["BookedBy","JobNumber","JobType","JobStatus"].map(name=>({name})),data:[["A","1","Estimate","Completed"]]}};
  const {readCsrSales}=await import("./call-center-sources");
  const result=await readCsrSales({fetchPaginatedReport} as never,Promise.resolve(booking),"2026-09-01","2026-09-30","2026-10-07T01:00:00Z");
  expect(result.byCsr).toEqual({a:1});expect(result.asOf).toBe("2026-10-06");
  expect(fetchPaginatedReport).toHaveBeenCalledWith(expect.objectContaining({reportId:"sold",parameters:[{name:"DateType",value:0},{name:"From",value:"2026-09-01"},{name:"To",value:"2026-10-06"}]}));
 });
 beforeEach(()=>{for(const key of Object.keys(mapping))delete mapping[key]});
 it("discovers quarter reports, retains explicit month precedence, and ignores quarterly totals",async()=>{
  mapping["2026-09"]="explicit-september";
  const sheets=client();
  sheets.listFolderFiles.mockImplementation(async(id:string)=>id==="folder"?[file("q","Q1 - 2026","application/vnd.google-apps.folder"),file("copy","September 2026 - Call Center Report")]:[file("jan","January 2026 - Call Center Report"),file("quarter","Quarterly Report - Q1 2026")]);
  sheets.getValues.mockImplementation(async(_:string,id:string)=>({values:[headers,...(id==="jan"?[["Nina Naem","1/3/2026","","","Text","Good","Booked","","","","","Yelp"]]:id==="explicit-september"?[["Nina Naem","9/3/2026","","","Text","Mid","Booked","","","","","Yelp"]]:[])]}));
  const {readCsrTextSources}=await import("./call-center-sources");const result=await readCsrTextSources(sheets as unknown as GoogleSheetsClient,"2026-01-01","2026-09-28");
  expect(result.byCsr["nina naeem"]).toBe(2);expect(result.source.coveredMonths).toEqual(["2026-01","2026-09"]);expect(result.source.status).toBe("partial");
  expect(sheets.getValues.mock.calls.some(([,id])=>id==="quarter"||id==="copy")).toBe(false);
  expect(sheets.getValues.mock.calls.every(([range])=>range==="'Master Sheet'!C1:N20")).toBe(true);
 });
 it("keeps the configured monthly table working if Drive is unavailable",async()=>{
  mapping["2026-09"]="september";const sheets=client();sheets.listFolderFiles.mockRejectedValue(new Error("Drive disabled"));
  const {readCsrTextSources}=await import("./call-center-sources");const result=await readCsrTextSources(sheets as unknown as GoogleSheetsClient,"2026-09-01","2026-09-28");expect(result.source.status).toBe("available");expect(result.byCsr).toEqual({});
 });
 it("does not guess between duplicate monthly reports",async()=>{
  const sheets=client();sheets.listFolderFiles.mockResolvedValue([file("first","May 2026 - Call Center Report"),file("second","May 2026 - Call Center Report")]);
  const {readCsrTextSources}=await import("./call-center-sources");const result=await readCsrTextSources(sheets as unknown as GoogleSheetsClient,"2026-05-01","2026-05-31");expect(result.source.status).toBe("unavailable");expect(sheets.getValues.mock.calls.some(([,id])=>id==="first"||id==="second")).toBe(false);
 });
});
