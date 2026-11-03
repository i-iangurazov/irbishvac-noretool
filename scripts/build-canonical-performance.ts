import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@irbis/db";
import { DashboardService } from "../apps/api/src/modules/dashboard/dashboard.service";
import { PersonnelService } from "../apps/api/src/modules/personnel/personnel.service";
import { DashboardRefreshRunner } from "../apps/worker/src/runner";

const flag = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };

async function main() {
  const cycle = flag("--cycle"), from = flag("--from-date"), to = flag("--cutoff-date"), output = flag("--output");
  if ((cycle !== "technician" && cycle !== "advisor") || !from || !to || !output) throw new Error("Cycle, dates and output are required");
  const family = cycle === "advisor" ? "advisors" : "technicians";
  const personnel = new PersonnelService();
  const directory = await personnel.refresh(to.slice(0, 7));
  const startedAt = Date.now();
  const useCurrent = process.argv.includes("--use-current");
  if (!useCurrent) await new DashboardRefreshRunner().refreshFamily(family, `coaching-${cycle}-${to}`, { from, to });
  const service = new DashboardService();
  const dashboard = cycle === "advisor" ? await service.getPerformanceAdvisors({ from, to }) : await service.getPerformanceTechnicians({ from, to });
  if (!dashboard.snapshotTime || Date.parse(dashboard.snapshotTime) < (useCurrent ? Date.now() - 60*60_000 : startedAt - 1000)) throw new Error("Canonical source snapshot timestamp is missing");
  const expected = directory.staff.filter(person => person.cycle === cycle).map(person => person.technicianId).sort();
  const actual = dashboard.rows.map(row => row.technicianId).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error("Staff changed while preparing canonical metrics; regenerate");
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, JSON.stringify({ schemaVersion: 1, sourceKind: cycle, periodFrom: from, cutoffDate: to,
    generatedAt: new Date().toISOString(), directory, dashboard }, null, 2));
  console.log(JSON.stringify({ canonicalStaff: actual.length, periodFrom: from, cutoffDate: to }));
}
main().catch(error => { console.error(JSON.stringify({ operation: "canonical-performance", errorType: error.name })); process.exitCode = 1; }).finally(() => prisma.$disconnect());
