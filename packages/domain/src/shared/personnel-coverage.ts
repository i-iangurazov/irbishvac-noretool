/** Only validated, fully paginated activity reports can prove that an omitted person had no activity. */
export type PersonnelSourceCoverage = { businessUnitIds: string[] | null };

export function personnelSourceCoverage(input: unknown, requiredFields: string[]): PersonnelSourceCoverage | undefined {
  if (!input || typeof input !== "object") return;
  const source = input as Record<string, unknown>;
  const coverage = source.personnelCoverage as Record<string, unknown> | undefined;
  if (coverage?.complete !== true || source.hasMore !== false || !Array.isArray(source.data)
    || source.totalCount !== source.data.length || !Array.isArray(source.fields)) return;
  const fields = new Set(source.fields.map(field => (field as { name?: string })?.name));
  if (!requiredFields.every(field => fields.has(field))) return;
  if (coverage.businessUnitIds !== null && (!Array.isArray(coverage.businessUnitIds)
    || !coverage.businessUnitIds.every(id => typeof id === "string"))) return;
  return { businessUnitIds: coverage.businessUnitIds as string[] | null };
}
