import { describe, expect, it } from "vitest";
import { buildPerformancePersonnelDirectory, assertPersonnelFresh, reconcileTechnicianPersonnel, reconcileAdvisorPersonnel, reconcileInstallerPersonnel } from "./personnel";
import { buildTechnicianDashboard } from "./metrics/technicians";
import { buildAdvisorDashboard } from "./metrics/advisors";
import { buildInstallerDashboard } from "./metrics/installers";

const units = [
  { id: 1, name: "HVAC - Service", active: true },
  { id: 2, name: "HVAC - Sales", active: true },
  { id: 3, name: "Plumbing - Service", active: true },
  { id: 4, name: "HVAC - Install", active: true },
];
const person = (id: number, businessUnitId = 1, extra = {}) => ({ id, name: `Person ${id}`, businessUnitId, active: true, isManagedTech: true, ...extra });

describe("shared personnel policy", () => {
  it("shows verified no-activity zeroes only for complete reports covering the employee's unit", () => {
    const directory = buildPerformancePersonnelDirectory([person(1), person(2, 3)], units);
    const fields = ["Name", "CompletedRevenue", "CompletedJobs", "TotalSales", "SalesOpportunity", "ClosedOpportunities", "MembershipsSold"].map(name => ({name}));
    const operationsSupplement = {fields:["Name","TechnicianId","CompletedRevenue","CompletedJobs","TotalSales","MembershipOpportunities","MembershipsSold","TotalLeadSales"].map(name=>({name})),data:[],hasMore:false,totalCount:0,personnelCoverage:{complete:true,businessUnitIds:null}};
    const payload = { fields, data: [], hasMore: false, totalCount: 0, personnelCoverage: { complete: true, businessUnitIds: ["1"] }, operationsSupplement };
    const result = reconcileTechnicianPersonnel(buildTechnicianDashboard(payload), directory);
    expect(result.rows[0]).toMatchObject({ actualSourceAvailable: true, noActivity: true, completedJobs: 0, totalSales: 0 });
    expect(result.rows[1]).toMatchObject({ actualSourceAvailable: false, noActivity: false });
    for (const broken of [{...payload, hasMore:true}, {...payload,totalCount:1}, {...payload,fields:[]}, {...payload,personnelCoverage:undefined}]) {
      expect(reconcileTechnicianPersonnel(buildTechnicianDashboard(broken), directory).rows[0]?.actualSourceAvailable).toBe(false);
    }
    expect(reconcileTechnicianPersonnel(buildTechnicianDashboard({...payload,operationsSupplement:undefined}),directory).rows[0]?.actualSourceAvailable).toBe(false);
  });

  it("uses reported completed jobs and preserves explicit zero", () => {
    expect(buildTechnicianDashboard([{Name:"Person 1",CompletedJobs:7}]).rows[0]?.completedJobs).toBe(7);
    expect(buildTechnicianDashboard([{Name:"Person 1",CompletedJobs:0}]).rows[0]?.completedJobs).toBe(0);
    expect(buildTechnicianDashboard([{Name:"Person 1"}]).rows[0]?.completedJobs).toBeNull();
  });

  it("distinguishes no advisor or installer activity from an incomplete source", () => {
    const directory = buildPerformancePersonnelDirectory([person(1,2),person(2,4)], units);
    const payload = (names:string[]) => ({fields:names.map(name=>({name})),data:[],hasMore:false,totalCount:0,personnelCoverage:{complete:true,businessUnitIds:null}});
    const advisors = buildAdvisorDashboard(payload(["Name","TechnicianId","TotalSales","SalesOpportunity","ClosedOpportunities"]));
    const installers = buildInstallerDashboard(payload(["Name","TechnicianId","CompletedRevenue","CompletedJobs","RecallsCaused","BillableEfficiency"]));
    expect(reconcileAdvisorPersonnel(advisors,directory).rows[0]).toMatchObject({actualSourceAvailable:true,noActivity:true,totalSales:0});
    expect(reconcileInstallerPersonnel(installers,directory).rows[0]).toMatchObject({actualSourceAvailable:true,noActivity:true,jobsCompleted:0});
  });
  it("keeps a new technician with no email, metrics or goals and removes inactive staff", () => {
    const directory = buildPerformancePersonnelDirectory([person(1), person(2, 1, { active: false })], units);
    const raw = buildTechnicianDashboard([{ Name: "Person 2", TechnicianId: "2", CompletedRevenue: 100 }]);
    const result = reconcileTechnicianPersonnel(raw, directory);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ technicianId: "1", name: "Person 1", actualSourceAvailable: false });
    expect(result.totals.completedRevenue).toBe(0);
    expect(directory.staff[0]?.email).toBeNull();
    // The original raw history remains unchanged.
    expect(raw.rows[0]?.completedRevenue).toBe(100);
  });

  it("uses current department after transfer, regardless of the historical report label", () => {
    const directory = buildPerformancePersonnelDirectory([person(1, 3)], units);
    const result = reconcileTechnicianPersonnel(buildTechnicianDashboard([{ Name: "Old name", TechnicianId: "1", TechnicianBusinessUnit: "HVAC - Service", CompletedRevenue: 200 }]), directory);
    expect(result.rows[0]).toMatchObject({ name: "Person 1", department: "plumbing-service", completedRevenue: 200, actualSourceAvailable: true });
  });

  it("matches by ID across renames and never attaches another explicit ID by name", () => {
    const directory = buildPerformancePersonnelDirectory([person(1)], units);
    const result = reconcileTechnicianPersonnel(buildTechnicianDashboard([{ Name: "Person 1", TechnicianId: "2", CompletedRevenue: 999 }]), directory);
    expect(result.rows[0]?.completedRevenue).toBe(0);
  });

  it("allows a unique name-only upstream row and controlled spelling aliases", () => {
    const directory = buildPerformancePersonnelDirectory([person(1)], units, new Date().toISOString(), { "1": ["Source spelling"] });
    const result = reconcileTechnicianPersonnel(buildTechnicianDashboard([{ Name: "Source spelling", CompletedRevenue: 77 }]), directory);
    expect(result.rows[0]?.completedRevenue).toBe(77);
  });

  it("refuses ambiguous source rows and duplicate IDs", () => {
    expect(() => buildPerformancePersonnelDirectory([person(1), person(1)], units)).toThrow(/duplicate technician ID/);
    const directory = buildPerformancePersonnelDirectory([person(1)], units);
    expect(() => reconcileTechnicianPersonnel(buildTechnicianDashboard([{ Name: "Person 1" }, { Name: "Person 1" }]), directory)).toThrow(/Ambiguous/);
    expect(() => reconcileTechnicianPersonnel(buildTechnicianDashboard([{ TechnicianId: "1" }, { TechnicianId: "1" }]), directory)).toThrow(/Duplicate metric/);
  });

  it("supports advisor and installer hires before their first activity", () => {
    const directory = buildPerformancePersonnelDirectory([person(1, 2), person(2, 4)], units);
    expect(reconcileAdvisorPersonnel(buildAdvisorDashboard([]), directory).rows[0]).toMatchObject({ technicianId: "1", totalSales: 0, actualSourceAvailable: false });
    expect(reconcileInstallerPersonnel(buildInstallerDashboard([]), directory).rows[0]).toMatchObject({ technicianId: "2", installedRevenue: 0, department: "hvac-install" });
  });

  it("accepts a completely empty active team instead of restoring departed people", () => {
    const directory = buildPerformancePersonnelDirectory([person(1, 1, { active: false })], units);
    expect(reconcileTechnicianPersonnel(buildTechnicianDashboard([{ Name: "Person 1" }]), directory).rows).toEqual([]);
  });

  it("rejects unknown activity flags and inactive business units", () => {
    const directory = buildPerformancePersonnelDirectory([person(1, 1, { active: undefined }), person(2, 2, { isManagedTech: false }), person(3, 5)], [...units, { id: 5, name: "HVAC - Service", active: false }]);
    expect(directory.staff).toEqual([]);
    expect(directory.excluded).toHaveLength(3);
  });

  it("enforces the agreed one-hour maximum, including corrupt and future timestamps", () => {
    const now = Date.parse("2026-11-03T12:00:00Z");
    const directory = buildPerformancePersonnelDirectory([], units, "2026-11-03T11:00:00Z");
    expect(() => assertPersonnelFresh(directory, 60, now)).not.toThrow();
    expect(() => assertPersonnelFresh(directory, 60, now + 1)).toThrow(/freshness/);
    expect(() => assertPersonnelFresh({ ...directory, fetchedAt: "invalid" }, 60, now)).toThrow();
    expect(() => assertPersonnelFresh({ ...directory, fetchedAt: "2026-11-03T12:06:00Z" }, 60, now)).toThrow();
  });
});
