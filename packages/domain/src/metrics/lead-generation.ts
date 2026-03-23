import { pickFirst, resolveTabularReport, toNumber, toRatio } from "../shared/report";

export type LeadGenerationRow = {
  name: string;
  leadsGenerated: number;
  goodLeads: number;
  bookedLeads: number;
  bookingRate: number;
  rankByLeadsGenerated?: number;
};

export type LeadGenerationResult = {
  rows: LeadGenerationRow[];
  rowsRanked: LeadGenerationRow[];
  leader: LeadGenerationRow | null;
  snapshotTime: string | null;
};

const ALIASES = {
  name: ["Name", "Team", "BusinessUnit", "Department"],
  leadGenerationOpportunity: ["LeadGenerationOpportunity"],
  replacementOpportunity: ["ReplacementOpportunity"],
  leadsSet: ["LeadsSet"],
  replacementLeadsSet: ["ReplacementLeadsSet"],
  totalJobsBooked: ["TotalJobsBooked"],
  bookingRate: ["LeadConversionRate", "BookingRate"]
};

export function buildLeadGenerationDashboard(input: unknown): LeadGenerationResult {
  const report = resolveTabularReport(input);

  const rows = report.rows
    .map((row) => {
      const leadsGenerated =
        toNumber(pickFirst(row, ALIASES.leadGenerationOpportunity)) +
        toNumber(pickFirst(row, ALIASES.replacementOpportunity));
      const goodLeads =
        toNumber(pickFirst(row, ALIASES.leadsSet)) +
        toNumber(pickFirst(row, ALIASES.replacementLeadsSet));
      const bookedLeads = toNumber(pickFirst(row, ALIASES.totalJobsBooked)) || goodLeads;
      const explicitRate = pickFirst(row, ALIASES.bookingRate);

      return {
        name: String(pickFirst(row, ALIASES.name) ?? ""),
        leadsGenerated,
        goodLeads,
        bookedLeads,
        bookingRate:
          explicitRate != null && explicitRate !== ""
            ? toRatio(explicitRate)
            : leadsGenerated > 0
              ? goodLeads / leadsGenerated
              : 0
      };
    })
    .filter((row) => row.name !== "");

  const rowsRanked = rows
    .slice()
    .sort(
      (left, right) =>
        right.leadsGenerated - left.leadsGenerated ||
        right.bookedLeads - left.bookedLeads ||
        left.name.localeCompare(right.name),
    )
    .map((row, index) => ({ ...row, rankByLeadsGenerated: index + 1 }));

  return {
    rows,
    rowsRanked,
    leader: rowsRanked[0] ?? null,
    snapshotTime: report.snapshotTime
  };
}
