import { beforeEach, describe, expect, it, vi } from "vitest";
const mapping: Record<string, string> = {};
vi.mock("@irbis/config", () => ({ getConfig: () => ({
  campaignPerformance: { google: { spreadsheetId: "august", spreadsheetIdsByMonth: mapping } },
  csr: { reportsFolderId: "shared" },
}) }));
import { GoogleSheetsClient } from "./sheets";
const file=(id:string,name:string,mimeType="application/vnd.google-apps.spreadsheet")=>({id,name,mimeType});
const metadata=(title:string,master=true)=>({properties:{title},sheets:master?[{properties:{title:"Master Sheet"}}]:[]});
function client() {
  const value=new GoogleSheetsClient();
  vi.spyOn(value,"getSpreadsheetMetadata").mockImplementation(async(id)=>metadata(id==="november"?"November 2026 - Call Center Report":"August 2026 - Call Center Report"));
  vi.spyOn(value,"listFolderFiles").mockResolvedValue([]);
  return value;
}
beforeEach(()=>{for(const month of Object.keys(mapping)) delete mapping[month]});
describe("monthly Call Center source selection",()=>{
  it("uses an explicit month mapping without probing unrelated files",async()=>{
    mapping["2026-11"]="approved-november";const value=client();
    expect(await value.resolveMonthlySpreadsheetId("2026-11")).toBe("approved-november");
    expect(value.getSpreadsheetMetadata).not.toHaveBeenCalled();
  });
  it("keeps the legacy default only for its own verified month",async()=>{
    const value=client();expect(await value.resolveMonthlySpreadsheetId("2026-08")).toBe("august");
    await expect(value.resolveMonthlySpreadsheetId("2026-11")).rejects.toThrow("found 0");
  });
  it("discovers the current year file and ignores last year, templates and quarterly totals",async()=>{
    const value=client();vi.mocked(value.listFolderFiles).mockResolvedValue([file("november","November 2026 - Call Center Report"),file("old","November 2025 - Call Center Report"),file("draft","Draft November 2026"),file("quarter","Quarterly November 2026")]);
    expect(await value.resolveMonthlySpreadsheetId("2026-11")).toBe("november");
  });
  it("uses the year from a shared quarter folder",async()=>{
    const value=client();vi.mocked(value.listFolderFiles).mockImplementation(async(id)=>id==="shared"?[file("quarter","Q4 - 2026","application/vnd.google-apps.folder")]:[file("november","November - Call Center Report")]);
    expect(await value.resolveMonthlySpreadsheetId("2026-11")).toBe("november");
  });
  it("fails closed for ambiguous reports, unavailable Drive or missing Master Sheet",async()=>{
    const value=client();vi.mocked(value.listFolderFiles).mockResolvedValue([file("one","November 2026"),file("two","November 2026")]);
    await expect(value.resolveMonthlySpreadsheetId("2026-11")).rejects.toThrow("found 2");
    vi.mocked(value.listFolderFiles).mockRejectedValue(new Error("Drive unavailable"));
    await expect(value.resolveMonthlySpreadsheetId("2026-11")).rejects.toThrow("Drive unavailable");
    vi.mocked(value.listFolderFiles).mockResolvedValue([file("november","November 2026")]);
    vi.mocked(value.getSpreadsheetMetadata).mockImplementation(async(id)=>metadata(id==="november"?"November 2026":"August 2026",id!=="november"));
    await expect(value.resolveMonthlySpreadsheetId("2026-11")).rejects.toThrow("no Master Sheet");
  });
});
