import type { FieldStaffDepartment, FieldStaffSourceFamily } from "./metrics/field-staff-departments";
import { buildTechnicianDashboard, withTechnicianRows, type TechnicianDashboard } from "./metrics/technicians";
import { buildAdvisorDashboard, withAdvisorRows, type AdvisorDashboard } from "./metrics/advisors";
import { buildInstallerDashboard, withInstallerRows, type InstallerDashboard } from "./metrics/installers";

type SourceRow = Record<string, unknown>;

// Business-unit policy, never an employee allowlist. Membership comes from ServiceTitan.
const UNITS: Record<string, [FieldStaffDepartment, string, FieldStaffSourceFamily]> = {
  "hvac service": ["hvac-service", "HVAC Service", "technicians"],
  "hvac maintenance": ["hvac-service", "HVAC Maintenance", "technicians"],
  "plumbing service": ["plumbing-service", "Plumbing Service", "technicians"],
  "electrical service": ["electrical-service", "Electrical Service", "technicians"],
  "hvac sales": ["hvac-comfort-advisor", "HVAC Sales", "advisors"],
  "hvac install": ["hvac-install", "HVAC Install", "installers"],
  "hvac installation": ["hvac-install", "HVAC Install", "installers"],
  "plumbing install": ["plumbing-install", "Plumbing Install", "installers"],
  "plumbing installation": ["plumbing-install", "Plumbing Install", "installers"],
  "electrical install": ["electrical-install", "Electrical Install", "installers"],
  "electrical installation": ["electrical-install", "Electrical Install", "installers"],
};

export type PerformanceStaff = {
  technicianId: string;
  technician: string;
  slug: string;
  email: string | null;
  active: true;
  isManagedTech: true;
  businessUnitId: string;
  businessUnit: string;
  department: string;
  dashboardDepartment: FieldStaffDepartment;
  sourceFamily: FieldStaffSourceFamily;
  cycle: "technician" | "advisor" | "installer";
  reportAliases: string[];
  startedOn: string | null;
};

export type PerformancePersonnelDirectory = {
  schemaVersion: 1;
  source: string;
  fetchedAt: string;
  selectionPolicy: string;
  staff: PerformanceStaff[];
  excluded: Array<{ technicianId: string; reason: string }>;
};

export function personnelIdentity(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function buildPerformancePersonnelDirectory(
  technicians: SourceRow[],
  units: SourceRow[],
  fetchedAt = new Date().toISOString(),
  aliasesById: Record<string, string[]> = {},
): PerformancePersonnelDirectory {
  if (!Number.isFinite(Date.parse(fetchedAt))) throw new Error("Invalid personnel timestamp");
  const unitMap = new Map<string, SourceRow>();
  for (const unit of units) {
    const id = String(unit.id ?? "");
    if (!id || unitMap.has(id)) throw new Error("Missing or duplicate business-unit ID");
    unitMap.set(id, unit);
  }
  const staff: PerformanceStaff[] = [];
  const excluded: PerformancePersonnelDirectory["excluded"] = [];
  const seen = new Set<string>();
  for (const row of technicians) {
    const technicianId = String(row.id ?? "");
    if (!technicianId || seen.has(technicianId)) throw new Error("Missing or duplicate technician ID");
    seen.add(technicianId);
    const unit = unitMap.get(String(row.businessUnitId));
    const businessUnit = String(unit?.name ?? "");
    const policy = UNITS[businessUnit.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()];
    const reason = row.active !== true ? "inactive_or_unconfirmed_status"
      : row.isManagedTech !== true ? "not_managed_field_staff"
      : unit?.active !== true ? "inactive_or_unknown_business_unit"
      : !policy ? "outside_supported_field_units" : null;
    if (reason || !policy || !unit) {
      excluded.push({ technicianId, reason: reason ?? "outside_supported_field_units" });
      continue;
    }
    const technician = String(row.name ?? "").trim();
    if (!technician) throw new Error("Active technician has no name");
    const [dashboardDepartment, department, sourceFamily] = policy;
    staff.push({
      technicianId, technician, slug: `staff-${technicianId}`,
      email: String(row.email ?? "").trim() || null,
      active: true, isManagedTech: true,
      businessUnitId: String(unit.id), businessUnit, department, dashboardDepartment, sourceFamily,
      cycle: sourceFamily === "advisors" ? "advisor" : sourceFamily === "installers" ? "installer" : "technician",
      reportAliases: aliasesById[technicianId] ?? [],
      startedOn: typeof row.startDate === "string" ? row.startDate : null,
    });
  }
  // Empty is valid after a complete export: the last employee may have left.
  // Broken/partial pagination must be rejected by the source client before this function.
  const names = new Set<string>();
  for (const person of staff) {
    const name = personnelIdentity(person.technician);
    if (names.has(name)) throw new Error("Duplicate personnel name requires identity reconciliation");
    names.add(name);
  }
  return {
    schemaVersion: 1, source: "ServiceTitan settings technicians + business-units", fetchedAt,
    selectionPolicy: "active AND isManagedTech AND active supported business unit",
    staff: staff.sort((a, b) => a.technicianId.localeCompare(b.technicianId)), excluded,
  };
}

export function assertPersonnelFresh(directory: PerformancePersonnelDirectory, maxAgeMinutes = 60, now = Date.now()) {
  const age = now - Date.parse(directory.fetchedAt);
  if (directory.schemaVersion !== 1 || !Array.isArray(directory.staff) || !Number.isFinite(age) || age < -300_000 || age > maxAgeMinutes * 60_000)
    throw new Error("Personnel directory unavailable or older than the agreed freshness limit");
}

type MetricIdentity = { name: string; technicianId: string | null };

function reconcileRows<T extends MetricIdentity>(
  rows: T[], directory: PerformancePersonnelDirectory, family: FieldStaffSourceFamily,
  empty: (person: PerformanceStaff) => T,
) {
  const personnel = directory.staff.filter(person => person.sourceFamily === family);
  return personnel.map(person => {
    const byId = rows.filter(row => row.technicianId === person.technicianId);
    if (byId.length > 1) throw new Error("Duplicate metric rows for personnel ID");
    const names = new Set([person.technician, ...person.reportAliases].map(personnelIdentity));
    const byName = byId.length ? [] : rows.filter(row => !row.technicianId && names.has(personnelIdentity(row.name)));
    if (byName.length > 1 || byName.some(row => personnel.some(other => other.technicianId !== person.technicianId && [other.technician, ...other.reportAliases].some(name => personnelIdentity(name) === personnelIdentity(row.name)))))
      throw new Error("Ambiguous name-only metric rows");
    const actual = byId[0] ?? byName[0];
    return {
      ...(actual ?? empty(person)),
      name: person.technician, technicianId: person.technicianId,
      businessUnit: person.businessUnit, department: person.dashboardDepartment,
      actualSourceAvailable: actual !== undefined,
    };
  });
}

export function reconcileTechnicianPersonnel(dashboard: TechnicianDashboard, directory: PerformancePersonnelDirectory): TechnicianDashboard {
  const rows = reconcileRows(dashboard.rows, directory, "technicians", person => buildTechnicianDashboard([{ Name: person.technician }]).rows[0]!);
  return { ...withTechnicianRows(dashboard, rows), personnelFetchedAt: directory.fetchedAt };
}

export function reconcileAdvisorPersonnel(dashboard: AdvisorDashboard, directory: PerformancePersonnelDirectory): AdvisorDashboard {
  const rows = reconcileRows(dashboard.rows, directory, "advisors", person => buildAdvisorDashboard([{ Name: person.technician }]).rows[0]!);
  return { ...withAdvisorRows(dashboard, rows), personnelFetchedAt: directory.fetchedAt };
}

export function reconcileInstallerPersonnel(dashboard: InstallerDashboard, directory: PerformancePersonnelDirectory): InstallerDashboard {
  const rows = reconcileRows(dashboard.rows, directory, "installers", person => buildInstallerDashboard([{ Name: person.technician }]).rows[0]!);
  return { ...withInstallerRows(dashboard, rows), personnelFetchedAt: directory.fetchedAt };
}
