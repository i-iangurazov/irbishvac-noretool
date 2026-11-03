/** Rebuild an exact saved scope with an independently complete operations export; preview by default. */
import {readFile} from "node:fs/promises";
import path from "node:path";
import {prisma, type Prisma} from "@irbis/db";
import {buildTechnicianDashboard,reconcileTechnicianPersonnel} from "@irbis/domain";
import {PersonnelService} from "../apps/api/src/modules/personnel/personnel.service";
async function main(){
  const index=process.argv.indexOf("--source-dir"),folder=index>=0?process.argv[index+1]:undefined;
  if(!folder)throw Error("Source folder required");
  const manifest=JSON.parse(await readFile(path.join(folder,"export-manifest.json"),"utf8"));
  const operational=JSON.parse(await readFile(path.join(folder,"operations_performance.json"),"utf8"));
  if(manifest.failedReports?.length || !manifest.selectedReports?.includes("operations_performance"))throw Error("Incomplete source manifest");
  const original=await prisma.rawReportSnapshot.findFirst({where:{family:"TECHNICIANS",businessDateFrom:new Date(manifest.fromDate),businessDateTo:new Date(manifest.toDate)},orderBy:{fetchedAt:"desc"}});
  if(!original)throw Error("Matching primary source missing");
  const sourceTime=new Date(Math.min(original.sourceSnapshotTime?.getTime()??original.fetchedAt.getTime(),Date.parse(manifest.completedAt)));
  if(!Number.isFinite(sourceTime.getTime()) || Date.now()-sourceTime.getTime()>60*60_000)throw Error("Source is stale");
  const payload={...(original.payloadJson as object),operationsSupplement:{...operational,personnelCoverage:{complete:true,businessUnitIds:null}},operationsSource:{reportId:"7966542",category:"operations",from:manifest.fromDate,to:manifest.toDate,fetchedAt:manifest.completedAt}};
  const dashboard=buildTechnicianDashboard(payload);
  if(!dashboard.sourceCoverage)throw Error("Source completeness validation failed");
  const reconciled=reconcileTechnicianPersonnel(dashboard,await new PersonnelService().directory());
  console.log(JSON.stringify({apply:process.argv.includes("--apply"),sourceTime,from:manifest.fromDate,to:manifest.toDate,rows:reconciled.rows.map(row=>({id:row.technicianId,name:row.name,jobs:row.completedJobs,revenue:row.completedRevenue,sales:row.totalSales,available:row.actualSourceAvailable}))}));
  if(!process.argv.includes("--apply"))return;
  await prisma.$transaction(async db=>{
    const raw=await db.rawReportSnapshot.create({data:{family:original.family,tenantId:original.tenantId,category:original.category,reportId:original.reportId,legacyTableName:original.legacyTableName,requestHash:original.requestHash,businessDateFrom:original.businessDateFrom,businessDateTo:original.businessDateTo,sourceSnapshotTime:sourceTime,payloadJson:payload as Prisma.InputJsonValue}});
    const data={payloadJson:dashboard as unknown as Prisma.InputJsonValue,sourceSnapshotIds:[original.id,raw.id],snapshotTime:sourceTime,businessDateFrom:original.businessDateFrom,businessDateTo:original.businessDateTo};
    await db.dashboardReadModel.upsert({where:{family_scopeKey:{family:original.family,scopeKey:original.requestHash}},create:{family:original.family,scopeKey:original.requestHash,...data},update:data});
  });
}
main().catch(error=>{console.error(JSON.stringify({operation:"repair-technician-operations",errorType:error.name,message:error.message}));process.exitCode=1;}).finally(()=>prisma.$disconnect());
