import {readFile} from "node:fs/promises";
import {prisma} from "@irbis/db";
async function main(){
  const sql=await readFile("packages/db/sql/performance-coaching.sql","utf8");
  await prisma.$executeRawUnsafe(sql);
  console.log(JSON.stringify({coachingSchema:"installed-additively"}));
}
main().catch(error=>{console.error(JSON.stringify({operation:"install-coaching-schema",errorType:error.name}));process.exitCode=1;}).finally(()=>prisma.$disconnect());
