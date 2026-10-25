import {
  BUSINESS_UNIT_FIELD_KEYS,
  classifyFieldStaffDepartment,
  type FieldStaffDepartment,
  POSITION_FIELD_KEYS,
  readTextField,
  TECHNICIAN_ID_FIELD_KEYS,
} from "./field-staff-departments";
import {
  pickFirst,
  resolveTabularReport,
  sumBy,
  toNumber,
  toRatio,
  weightedAverage,
} from "../shared/report";

export type AdvisorMetricRow = {
  name: string;
  businessUnit: string | null;
  department: FieldStaffDepartment | null;
  position: string | null;
  technicianId: string | null;
  totalSales: number;
  closedAverageSale: number;
  closedOpportunitiesCount: number;
  closeRateRolling: number;
  salesOpportunitiesCount: number;
  rankBySales?: number;
};

export type AdvisorDashboard = {
  rows: AdvisorMetricRow[];
  rowsRanked: AdvisorMetricRow[];
  totals: {
    totalSales: number;
    totalOpportunities: number;
    totalClosedOpportunities: number;
    weightedCloseRate: number;
    weightedClosedAverageSale: number;
  };
  snapshotTime: string | null;
};

export type AdvisorRosterMember = {
  technicianId: string;
  name: string;
  businessUnit: string;
};

/** Add active sales-BU staff before their first sale, without changing report metrics. */
export function mergeAdvisorRoster(
  dashboard: AdvisorDashboard,
  roster: AdvisorRosterMember[],
): AdvisorDashboard {
  const rows = [...dashboard.rows];
  const ids = new Set(rows.map((row) => row.technicianId).filter(Boolean));
  const names = new Set(
    rows
      .filter((row) => !row.technicianId)
      .map((row) => row.name.trim().toLowerCase()),
  );
  for (const person of roster) {
    if (
      !person.technicianId ||
      !person.name.trim() ||
      ids.has(person.technicianId) ||
      names.has(person.name.trim().toLowerCase())
    )
      continue;
    ids.add(person.technicianId);
    rows.push({
      ...person,
      department: "hvac-comfort-advisor",
      position: "Sales",
      totalSales: 0,
      closedAverageSale: 0,
      closedOpportunitiesCount: 0,
      closeRateRolling: 0,
      salesOpportunitiesCount: 0,
    });
  }
  return {
    ...dashboard,
    rows,
    rowsRanked: rankAdvisorRows(rows),
    totals: calculateAdvisorTotals(rows),
  };
}

/** Settings membership is authoritative; an employee's name/role is never a whitelist. */
export function selectAdvisorRoster(
  technicians: unknown[],
  businessUnits: unknown[],
  configuredIds: readonly (string | number)[],
): AdvisorRosterMember[] {
  const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const allowed = new Set(configuredIds.map(String));
  const units = new Map(
    businessUnits.map((value) => {
      const unit = record(value);
      return [String(unit.id), unit];
    }),
  );
  const roster: AdvisorRosterMember[] = [];
  const seen = new Set<string>();
  for (const value of technicians) {
    const person = record(value),
      id = String(person.id ?? ""),
      unitId = String(person.businessUnitId ?? ""),
      unit = units.get(unitId);
    if (
      person.active !== true ||
      !id ||
      seen.has(id) ||
      !allowed.has(unitId) ||
      unit?.active !== true ||
      typeof person.name !== "string" ||
      !person.name.trim()
    )
      continue;
    seen.add(id);
    roster.push({
      technicianId: id,
      name: person.name.trim(),
      businessUnit: String(unit.name ?? "HVAC - Sales"),
    });
  }
  return roster;
}

export function buildAdvisorDashboard(input: unknown): AdvisorDashboard {
  const report = resolveTabularReport(input);

  const rows = report.rows
    .map((row) => {
      const businessUnit = readTextField(row, BUSINESS_UNIT_FIELD_KEYS);
      const position = readTextField(row, POSITION_FIELD_KEYS);
      const technicianId = readTextField(row, TECHNICIAN_ID_FIELD_KEYS);
      const totalSales = toNumber(row.TotalSales);
      const upstreamClosedAverageSale = toNumber(row.ClosedAverageSale);
      const explicitClosedOpportunities = toNumber(
        pickFirst(row, [
          "ClosedOpportunities",
          "Closed Opportunities",
          "ClosedOpportunity",
          "Closed Opportunity",
          "ClosedJobs",
          "Closed Jobs",
          "SoldJobs",
          "Sold Jobs",
        ]),
      );
      const closedOpportunitiesCount =
        explicitClosedOpportunities > 0
          ? explicitClosedOpportunities
          : upstreamClosedAverageSale > 0
            ? totalSales / upstreamClosedAverageSale
            : 0;

      return {
        name: String(row.Name ?? ""),
        businessUnit,
        department: classifyFieldStaffDepartment({
          businessUnit,
          position,
          sourceFamily: "advisors",
        }),
        position,
        technicianId,
        totalSales,
        closedAverageSale:
          closedOpportunitiesCount > 0
            ? totalSales / closedOpportunitiesCount
            : 0,
        closedOpportunitiesCount,
        closeRateRolling: toRatio(row.CloseRateRolling),
        salesOpportunitiesCount: toNumber(row.SalesOpportunity),
      };
    })
    .filter(
      (row) =>
        row.name !== "" ||
        row.totalSales > 0 ||
        row.closedAverageSale > 0 ||
        row.closedOpportunitiesCount > 0 ||
        row.salesOpportunitiesCount > 0,
    );

  const rowsRanked = rankAdvisorRows(rows);

  return {
    rows,
    rowsRanked,
    totals: calculateAdvisorTotals(rows),
    snapshotTime: report.snapshotTime,
  };
}

function rankAdvisorRows(rows: AdvisorMetricRow[]) {
  return rows
    .slice()
    .sort(
      (left, right) =>
        right.totalSales - left.totalSales ||
        left.name.localeCompare(right.name),
    )
    .map((row, index) => ({ ...row, rankBySales: index + 1 }));
}

function calculateAdvisorTotals(
  rows: AdvisorMetricRow[],
): AdvisorDashboard["totals"] {
  const totalSales = sumBy(rows, (row) => row.totalSales);
  const totalClosedOpportunities = sumBy(
    rows,
    (row) => row.closedOpportunitiesCount,
  );

  return {
    totalSales,
    totalOpportunities: sumBy(rows, (row) => row.salesOpportunitiesCount),
    totalClosedOpportunities,
    weightedCloseRate: Number(
      weightedAverage(
        rows,
        (row) => row.closeRateRolling,
        (row) => row.salesOpportunitiesCount,
      ).toFixed(3),
    ),
    weightedClosedAverageSale: Number(
      (totalClosedOpportunities > 0
        ? totalSales / totalClosedOpportunities
        : 0
      ).toFixed(2),
    ),
  };
}

export function filterAdvisorDashboardByDepartment(
  dashboard: AdvisorDashboard,
  department: FieldStaffDepartment,
): AdvisorDashboard {
  const sourceRows = Array.isArray(dashboard.rows)
    ? dashboard.rows
    : (dashboard.rowsRanked ?? []);
  const rows = sourceRows.filter((row) => {
    const resolvedDepartment =
      row.department ??
      classifyFieldStaffDepartment({
        businessUnit: row.businessUnit,
        position: row.position,
        sourceFamily: "advisors",
      });

    return resolvedDepartment === department;
  });

  return {
    ...dashboard,
    rows,
    rowsRanked: rankAdvisorRows(rows),
    totals: calculateAdvisorTotals(rows),
  };
}
