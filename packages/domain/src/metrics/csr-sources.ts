import { resolveTabularReport, sumBy } from "../shared/report";

export type CsrSourceState = {
  status: "available" | "partial" | "unavailable";
  updatedAt: string | null;
  coveredMonths?: string[];
  missingMonths?: string[];
};
export type CsrSupplement = {
  version: 1;
  from: string;
  to: string;
  text: {
    source: CsrSourceState;
    byCsr: Record<string, number>;
    byChannel: Record<string, Record<string, number>>;
    unassigned: number;
  };
  jobs: {
    source: CsrSourceState;
    byCsr: Record<
      string,
      { booked: number; cancelled: number; byType: Record<string, number> }
    >;
  };
  memberships: { source: CsrSourceState; byCsr: Record<string, number> };
};

// Explicit alias verified against the September CSR report; never match on first name alone.
export function csrIdentity(name: unknown): string {
  const key = String(name ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return key === "nina naem" ? "nina naeem" : key;
}

export function csrDateKey(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return us
    ? `${us[3]}-${us[1]!.padStart(2, "0")}-${us[2]!.padStart(2, "0")}`
    : null;
}

export function csrMonths(from: string, to: string): string[] {
  const result: string[] = [];
  const date = new Date(`${from.slice(0, 7)}-01T12:00:00Z`);
  while (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 7) <= to.slice(0, 7) &&
    result.length < 120
  ) {
    result.push(date.toISOString().slice(0, 7));
    date.setUTCMonth(date.getUTCMonth() + 1);
  }
  return result;
}

export function emptyCsrSupplement(from: string, to: string): CsrSupplement {
  const source = (): CsrSourceState => ({
    status: "unavailable",
    updatedAt: null,
  });
  return {
    version: 1,
    from,
    to,
    text: {
      source: {
        ...source(),
        coveredMonths: [],
        missingMonths: csrMonths(from, to),
      },
      byCsr: {},
      byChannel: {},
      unassigned: 0,
    },
    jobs: { source: source(), byCsr: {} },
    memberships: { source: source(), byCsr: {} },
  };
}

/** Read only the consolidated Master Sheet, never also its duplicated channel tabs. */
export function buildCsrTextLeads(
  sheets: Array<{ month: string; values: unknown[][] }>,
  from: string,
  to: string,
  updatedAt: string,
): CsrSupplement["text"] {
  const result = emptyCsrSupplement(from, to).text;
  const covered = new Set<string>();
  for (const { month, values } of sheets) {
    const headers = (values[0] ?? []).map(csrIdentity);
    const column = (name: string) => {
      const normalized = csrIdentity(name);
      const exact = headers.indexOf(normalized);
      if (exact >= 0) return exact;
      // January's legacy export appends cell values to its header labels.
      const matches = headers.flatMap((header, index) =>
        header.startsWith(`${normalized} `) ? [index] : [],
      );
      return matches.length === 1 ? matches[0]! : -1;
    };
    const [csr, date, medium, quality, channel] = [
      "CSR",
      "Lead received",
      "Call/Text",
      "Opportunity",
      "Channel",
    ].map(column);
    if (
      [csr, date, medium, quality, channel].some(
        (index) => index == null || index < 0,
      )
    )
      continue;
    covered.add(month);
    for (const row of values.slice(1)) {
      const day = csrDateKey(row[date!]);
      if (!day || !day.startsWith(month) || day < from || day > to) continue;
      if (
        !["text", "form"].includes(csrIdentity(row[medium!])) ||
        !["good", "mid"].includes(csrIdentity(row[quality!]))
      )
        continue;
      const name = csrIdentity(row[csr!]);
      const source = String(row[channel!] ?? "").trim() || "Unspecified";
      result.byCsr[name] = (result.byCsr[name] ?? 0) + 1;
      result.byChannel[source] ??= {};
      result.byChannel[source]![name] =
        (result.byChannel[source]![name] ?? 0) + 1;
      if (!name) result.unassigned += 1;
    }
  }
  const requested = csrMonths(from, to);
  const missingMonths = requested.filter((month) => !covered.has(month));
  result.source = {
    status: !covered.size
      ? "unavailable"
      : missingMonths.length
        ? "partial"
        : "available",
    updatedAt: covered.size ? updatedAt : null,
    coveredMonths: [...covered].sort(),
    missingMonths,
  };
  return result;
}

export function buildCsrJobs(
  payload: unknown,
  updatedAt: string,
): CsrSupplement["jobs"] {
  const report = resolveTabularReport(payload);
  for (const field of ["BookedBy", "JobNumber", "JobType", "JobStatus"]) {
    if (!report.fields.some((item) => item.name === field))
      throw new Error(`CSR job report is missing ${field}`);
  }
  if ((payload as { hasMore?: boolean })?.hasMore)
    throw new Error("CSR job report is incomplete");
  const byCsr: CsrSupplement["jobs"]["byCsr"] = {};
  const seen = new Set<string>();
  for (const row of report.rows) {
    const id = String(row.JobNumber ?? "").trim();
    if (!id) throw new Error("CSR job report contains a missing job number");
    if (seen.has(id)) continue;
    seen.add(id);
    const name = csrIdentity(row.BookedBy);
    const type = String(row.JobType ?? "").trim() || "Unspecified";
    byCsr[name] ??= { booked: 0, cancelled: 0, byType: {} };
    byCsr[name]!.booked += 1;
    byCsr[name]!.cancelled += Number(
      ["canceled", "cancelled"].includes(csrIdentity(row.JobStatus)),
    );
    byCsr[name]!.byType[type] = (byCsr[name]!.byType[type] ?? 0) + 1;
  }
  return { source: { status: "available", updatedAt }, byCsr };
}

export function buildCsrMemberships(
  payload: unknown,
  from: string,
  to: string,
  updatedAt: string,
): CsrSupplement["memberships"] {
  const report = resolveTabularReport(payload);
  if (
    !report.fields.some((f) => f.name === "SoldBy") ||
    !report.fields.some((f) => f.name === "SoldOn") ||
    (payload as { hasMore?: boolean })?.hasMore
  )
    throw new Error("CSR membership report is incomplete");
  const byCsr: Record<string, number> = {};
  for (const row of report.rows) {
    const date = csrDateKey(row.SoldOn);
    if (!date || date < from || date > to) continue;
    const name = csrIdentity(row.SoldBy);
    byCsr[name] = (byCsr[name] ?? 0) + 1;
  }
  return { source: { status: "available", updatedAt }, byCsr };
}

export function sumCsrValues(
  values: Record<string, number>,
  names: Set<string>,
) {
  return sumBy(Object.entries(values), ([name, count]) =>
    names.has(name) ? count : 0,
  );
}

/** Filename metadata only; a sheet still has to expose the verified Master Sheet schema. */
export function csrReportMonth(name: string, parentName = ""): string | null {
  if (/\b(?:draft|template|quarterly)\b/i.test(name)) return null;
  const year =
    name.match(/\b(20\d{2})\b/)?.[1] ?? parentName.match(/\b(20\d{2})\b/)?.[1];
  const iso = name.match(/\b(20\d{2})[-_. ](0?[1-9]|1[0-2])\b/);
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, "0")}`;
  if (!year) return null;
  const monthNames = [
    "jan(?:uary)?",
    "feb(?:ruary)?",
    "mar(?:ch)?",
    "apr(?:il)?",
    "may",
    "jun(?:e)?",
    "jul(?:y)?",
    "aug(?:ust)?",
    "sep(?:t(?:ember)?)?",
    "oct(?:ober)?",
    "nov(?:ember)?",
    "dec(?:ember)?",
  ];
  const index = monthNames.findIndex((month) =>
    new RegExp(`\\b${month}\\b`, "i").test(name),
  );
  return index < 0 ? null : `${year}-${String(index + 1).padStart(2, "0")}`;
}
