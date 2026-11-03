type StaffAvailability = { actualSourceAvailable?: boolean };

export function staffMetricValue(
  value: number,
  formatter: (value: number) => string,
  available = true,
) {
  return available ? formatter(value) : "Unavailable";
}

export function staffTotalsAvailable(rows: StaffAvailability[], snapshotTime: string | null) {
  return Boolean(snapshotTime) && (rows.length === 0 || rows.some(row => row.actualSourceAvailable !== false));
}
