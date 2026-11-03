import { readFile } from 'node:fs/promises';
import { prisma } from '@irbis/db';
import { type PerformanceGoal } from '@irbis/domain';
import { PerformanceGoalsService } from '../apps/api/src/modules/personnel/performance-goals.service';
async function main(){
 const file=process.argv[2]; if(!file) throw new Error('Approved calculation file required');
 const input=JSON.parse(await readFile(file,'utf8')) as {month:string;approvalBasis:string;goals:Array<{goal:PerformanceGoal;calculation:unknown}>};
 const service=new PerformanceGoalsService();
 let approved=0;
 for(const row of input.goals){
  if(row.goal.approval_status!=='ACTIVE')continue;
  await service.approve({sourceKey:`raymond-email-2026-10-29-hr-months-v2:${input.month}:${row.goal.technicianId}`,approvedBy:input.approvalBasis+'; pre-hire months excluded per Ilias 2026-11-03',goal:row.goal});approved++;
 }
 console.log(JSON.stringify({month:input.month,approved,pending:input.goals.length-approved}));
}
main().catch(e=>{console.error(JSON.stringify({operation:'import-performance-goals',errorType:e.name}));process.exitCode=1}).finally(()=>prisma.$disconnect());
