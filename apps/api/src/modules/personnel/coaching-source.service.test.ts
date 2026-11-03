import {beforeEach,describe,expect,it,vi} from "vitest";
const query=vi.hoisted(()=>vi.fn());
vi.mock("@irbis/db",()=>({prisma:{$queryRaw:query}}));
import {CoachingSourceService} from "./coaching-source.service";
import {toBusinessDateString} from "@irbis/utils";

describe("current web coaching source",()=>{
  const directory=vi.fn();
  const service=new CoachingSourceService({directoryWithGoals:directory} as never);
  const today=toBusinessDateString(new Date(),"America/Los_Angeles");
  const snapshot=()=>({fetchedAt:new Date(),payloadJson:{periodFrom:`${today.slice(0,7)}-01`,cutoffDate:today,technicians:[{technicianId:"1",slug:"staff-1"},{technicianId:"2",slug:"staff-2"}]}});
  beforeEach(()=>{query.mockReset();directory.mockResolvedValue({staff:[{technicianId:"1",slug:"staff-1",technician:"Current name",cycle:"technician",department:"HVAC Service",email:null,goal:{month:today.slice(0,7),approval_status:"ACTIVE",monthly_sales_goal:1234}}]});});
  it("returns only the requested current employee from a fresh matching period",async()=>{
    query.mockResolvedValue([snapshot()]);
    const result=await service.forStaff("staff-1");
    expect(result?.technicians).toHaveLength(1);
    expect(result?.technicians[0]).toMatchObject({technicianId:"1",slug:"staff-1",technician:"Current name",department:"HVAC Service",email:null,plan:{monthlySalesGoal:1234}});
  });
  it("does not expose stale, previous-period or departed-staff sources",async()=>{
    const old=snapshot();old.fetchedAt=new Date(Date.now()-91*60_000);query.mockResolvedValue([old]);
    expect(await service.forStaff("staff-1")).toBeNull();
    const wrong=snapshot();wrong.payloadJson.cutoffDate="2026-01-01";query.mockResolvedValue([wrong]);
    expect(await service.forStaff("staff-1")).toBeNull();
    expect(await service.forStaff("staff-2")).toBeNull();
    await expect(service.forStaff("bad-input")).rejects.toMatchObject({status:400});
  });
});
