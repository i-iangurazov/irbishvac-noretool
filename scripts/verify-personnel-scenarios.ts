/** Read-only live-source replay: no test people are written to ST or the database. */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { MembershipSourceClient } from '@irbis/integrations';
import { assertPersonnelFresh, buildPerformancePersonnelDirectory, buildTechnicianDashboard, reconcileTechnicianPersonnel, resolvePerformanceGoal } from '@irbis/domain';
async function main() {
 const source=new MembershipSourceClient();
 const units=await source.list('business-units'), technicians=await source.list('technicians');
 const directory=buildPerformancePersonnelDirectory(technicians,units);
 const technician=directory.staff.find(p=>p.cycle==='technician')!;
 const sales=directory.staff.find(p=>p.cycle==='advisor')!;
 assert(technician && sales);
 const synthetic={id:999999999999,name:'Isolated acceptance staff',active:true,isManagedTech:true,email:'acceptance@example.invalid',businessUnitId:Number(technician.businessUnitId)};
 const added=buildPerformancePersonnelDirectory([...technicians,synthetic],units);
 const fresh=reconcileTechnicianPersonnel(buildTechnicianDashboard([]),added).rows.find(r=>r.technicianId===String(synthetic.id));
 assert(fresh && fresh.actualSourceAvailable===false);
 assert.equal(resolvePerformanceGoal(added.staff.find(p=>p.technicianId===String(synthetic.id))!,'2026-11').approval_status,'UPDATED_GOAL_PENDING');
 const before=JSON.stringify(technicians);
 const inactive=buildPerformancePersonnelDirectory(technicians.map(p=>String(p.id)===technician.technicianId?{...p,active:false}:p),units);
 assert(!inactive.staff.some(p=>p.technicianId===technician.technicianId));
 const transferred=buildPerformancePersonnelDirectory(technicians.map(p=>String(p.id)===technician.technicianId?{...p,businessUnitId:Number(sales.businessUnitId)}:p),units);
 const moved=transferred.staff.find(p=>p.technicianId===technician.technicianId)!;
 assert.equal(moved.cycle,'advisor');
 assert.equal(moved.department,sales.department);
 const old=resolvePerformanceGoal(technician,'2026-11');
 assert.equal(resolvePerformanceGoal(moved,'2026-11',{...old,approval_status:'ACTIVE',monthly_sales_goal:1000,target_opportunities_monthly:10,target_rate:.5,target_average:200}).approval_status,'UPDATED_GOAL_PENDING');
 assert.throws(()=>assertPersonnelFresh({...directory,fetchedAt:new Date(Date.now()-61*60_000).toISOString()},60));
 assert.equal(JSON.stringify(technicians),before);
 const result={verifiedAt:new Date().toISOString(),sourceStaff:directory.staff.length,mode:'isolated replay of a complete live source; no external writes',checks:{newWithoutSalesOrGoals:true,deactivatedExcluded:true,departmentTransfer:true,oldRoleGoalRejected:true,staleSourceRejected:true,sourceHistoryPreserved:true}};
 const output=process.argv[2];if(output)await writeFile(output,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(JSON.stringify({operation:'personnel-acceptance',errorType:e.name}));process.exitCode=1});
