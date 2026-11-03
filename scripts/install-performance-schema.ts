/** Additive schema installation. This deliberately never uses db push/reset. */
import { readFile } from 'node:fs/promises';
import { prisma } from '@irbis/db';
import { PersonnelService } from '../apps/api/src/modules/personnel/personnel.service';
async function main() {
 const sql = await readFile('packages/db/sql/performance-personnel.sql', 'utf8');
 for (const statement of sql.replace(/--[^\n]*/g, '').split(';').map(s=>s.trim()).filter(Boolean)) await prisma.$executeRawUnsafe(statement);
 const directory = await new PersonnelService().refresh();
 console.log(JSON.stringify({schema:'additive-installed',staff:directory.staff.length,fetchedAt:directory.fetchedAt}));
}
main().catch(e=>{console.error(JSON.stringify({operation:'install-performance-schema',errorType:e.name}));process.exitCode=1}).finally(()=>prisma.$disconnect());
