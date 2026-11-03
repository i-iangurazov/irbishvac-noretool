import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getConfig } from "@irbis/config";
import { buildAdvisorDashboard, buildPerformancePersonnelDirectory, calculateAdvisorTargets, personnelIdentity, resolvePerformanceGoal, type AdvisorHistoryMonth } from "@irbis/domain";
import { MembershipSourceClient, ServiceTitanClient, getServiceTitanReportDefinitions, resolveReportRequest } from "@irbis/integrations";

const flag = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const month = flag("--month");
const output = flag("--output");
const cacheRoot = path.resolve(flag("--history") ?? "var/performance-goals/history");

async function main() {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !output) throw new Error("Month and output are required");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit" }).format(new Date());
  if (month > today) throw new Error("Historical months have not closed in Pacific time");
  const client = new ServiceTitanClient();
  const resources = new MembershipSourceClient(client);
  const directory = buildPerformancePersonnelDirectory(await resources.list("technicians"), await resources.list("business-units"));
  const employmentPath = flag("--employment");
  if (!employmentPath) throw new Error("Employment dates from the HR source are required; no pre-hire zero months assumed");
  const employment = JSON.parse(await readFile(employmentPath, "utf8")) as Record<string, { startedOn: string; source: string }>;
  const staff = directory.staff.filter(person => person.cycle === "advisor");
  const definition = getServiceTitanReportDefinitions().advisors;
  const history = new Map<string, AdvisorHistoryMonth[]>(staff.map(person => [person.technicianId, []]));
  const provenance: Array<{ month: string; reportId: string; fetchedAt: string; presentIds: string[] }> = [];
  await mkdir(cacheRoot, { recursive: true });
  const target = new Date(`${month}-01T12:00:00Z`);
  for (let back = 10; back >= 1; back--) {
    const from = new Date(target); from.setUTCMonth(from.getUTCMonth() - back);
    const end = new Date(from); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(end.getUTCDate() - 1);
    const period = { from: from.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
    const key = period.from.slice(0, 7);
    const cache = path.join(cacheRoot, `${key}-advisor-${definition.reportId}.json`);
    let saved: { reportId: string; from: string; to: string; fetchedAt: string; payload: unknown } | undefined;
    try { saved = JSON.parse(await readFile(cache, "utf8")); } catch { /* An absent source must be fetched. */ }
    if (!saved || saved.reportId !== definition.reportId || saved.from !== period.from || saved.to !== period.to) {
      const request = resolveReportRequest(definition, { ...period, timezone: getConfig().app.timezone });
      const response = await client.fetchPaginatedReport({ family: "advisors", category: definition.category, reportId: definition.reportId,
        parameters: request.parameters, correlationId: `advisor-goals-${month}-${key}`, retryRateLimits: true });
      saved = { reportId: definition.reportId, ...period, fetchedAt: new Date().toISOString(), payload: response.payload };
      await writeFile(cache, JSON.stringify(saved));
      // Separate requests for this report respect ServiceTitan's existing reporting limit.
      if (back > 1) await new Promise(resolve => setTimeout(resolve, 65_000));
    }
    const dashboard = buildAdvisorDashboard(saved.payload);
    const presentIds: string[] = [];
    for (const person of staff) {
      const byId = dashboard.rows.filter(row => row.technicianId === person.technicianId);
      const byName = dashboard.rows.filter(row => !row.technicianId && personnelIdentity(row.name) === personnelIdentity(person.technician));
      const matches = byId.length ? byId : byName;
      if (matches.length > 1) throw new Error("Historical employee identity is ambiguous");
      const row = matches[0];
      if (row) presentIds.push(person.technicianId);
      history.get(person.technicianId)!.push({ month: key, sales: row?.totalSales ?? 0, opportunities: row?.salesOpportunitiesCount ?? 0,
        closedOpportunities: row?.closedOpportunitiesCount ?? 0, employed: Boolean(employment[person.technicianId] && employment[person.technicianId]!.startedOn.slice(0, 7) <= key), complete: true });
    }
    provenance.push({ month: key, reportId: definition.reportId, fetchedAt: saved.fetchedAt, presentIds });
    console.log(JSON.stringify({ sourceMonth: key, complete: true, advisorRows: dashboard.rows.length }));
  }
  const goals = staff.map(person => {
    const months = history.get(person.technicianId)!;
    const goal = resolvePerformanceGoal(person, month);
    let calculated: ReturnType<typeof calculateAdvisorTargets>;
    try {
      calculated = calculateAdvisorTargets(month, months);
    } catch (error) {
      if (error instanceof Error && /^(Average sale and close rate|Employment history)/.test(error.message))
        return { goal, calculation: null, history: months, pendingReason: "Employment dates or closed-sale history are unavailable; no inferred goal is approved. The known 75-opportunity standard remains visible." };
      throw error;
    }
    return { goal: { ...goal, approval_status: "ACTIVE", monthly_sales_goal: calculated.monthlySalesGoal,
      target_average: calculated.targetAverage, target_rate: calculated.targetRate,
      source_note: "Raymond Porras email 2026-10-29: preceding ten calendar months, monthly sales x1.50, weighted average sale x1.50, weighted close rate x1.15; 75 opportunities. Only employed months in the ten-month window contribute to monthly averages; HR hire dates exclude pre-hire months." },
      calculation: calculated, history: months };
  });
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, JSON.stringify({ month, calculatedAt: new Date().toISOString(), formulaVersion: 1, directoryFetchedAt: directory.fetchedAt, employment,
    approvalBasis: "Raymond Porras emails 2026-10-29 23:21 and 23:22, acknowledged by Ilias 2026-10-30", provenance, goals }, null, 2));
  console.log(JSON.stringify({ month, advisors: goals.length, calculated: goals.filter(row => row.calculation).length, pending: goals.filter(row => !row.calculation).length, output }));
}
main().catch(error => { console.error(JSON.stringify({ operation: "advisor-goals", errorType: error.name,
  detail: /^(All ten|Historical|Calculated|Average|Invalid|Employment)/.test(error.message) ? error.message : "Source unavailable; no goals were approved" })); process.exitCode = 1; });
