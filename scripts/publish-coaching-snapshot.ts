import { readFile } from "node:fs/promises";
import { prisma } from "@irbis/db";
import { PersonnelService } from "../apps/api/src/modules/personnel/personnel.service";

async function main() {
  const file = process.argv[process.argv.indexOf("--snapshot") + 1];
  if (!process.argv.includes("--snapshot") || !file) throw new Error("Snapshot path required");
  const snapshot = JSON.parse(await readFile(file, "utf8"));
  const cycle = snapshot.sourceKind;
  if (!["technician", "advisor"].includes(cycle) || !snapshot.canonicalSource
    || !/^\d{4}-\d{2}-01$/.test(snapshot.periodFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.cutoffDate)
    || snapshot.periodFrom.slice(0,7) !== snapshot.cutoffDate.slice(0,7)
    || Date.now() - Date.parse(snapshot.serviceTitanSnapshotTime) > 60*60_000
    || !Number.isFinite(Date.parse(snapshot.serviceTitanSnapshotTime))) throw new Error("Invalid or stale coaching source");
  const directory = await new PersonnelService().directory();
  const expected = directory.staff.filter(person=>person.cycle===cycle).map(person=>person.technicianId).sort();
  const actual = snapshot.technicians.map((person:{technicianId:string})=>String(person.technicianId)).sort();
  if (JSON.stringify(expected)!==JSON.stringify(actual)) throw new Error("Coaching source and current staff differ");
  const fetchedAt = new Date();
  await prisma.$executeRaw`INSERT INTO "PerformanceCoachingSnapshot" ("cycle","periodFrom","cutoffDate","fetchedAt","payloadJson")
    VALUES (${cycle},${snapshot.periodFrom},${snapshot.cutoffDate},${fetchedAt},${JSON.stringify(snapshot)}::jsonb)
    ON CONFLICT ("cycle") DO UPDATE SET "periodFrom"=EXCLUDED."periodFrom","cutoffDate"=EXCLUDED."cutoffDate",
    "fetchedAt"=EXCLUDED."fetchedAt","payloadJson"=EXCLUDED."payloadJson"`;
  console.log(JSON.stringify({coachingPublished:cycle,staff:actual.length,cutoffDate:snapshot.cutoffDate}));
}
main().catch(error=>{console.error(JSON.stringify({operation:"publish-coaching",errorType:error.name,message:error.message}));process.exitCode=1;}).finally(()=>prisma.$disconnect());
