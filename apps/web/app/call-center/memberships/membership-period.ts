export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export const dateValue = (date: string) => new Date(`${date}T12:00:00Z`);
export const shiftDate = (date: string, days: number) => {
  const value = dateValue(date);
  value.setUTCDate(value.getUTCDate() + days);
  return dateKey(value);
};
export const monthStart = (date: string, offset = 0) => {
  const value = dateValue(date);
  return dateKey(
    new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + offset, 1, 12),
    ),
  );
};
export const periodDays = (from: string, to: string) =>
  Math.round(
    (dateValue(to).getTime() - dateValue(from).getTime()) / 86_400_000,
  ) + 1;
export const displayDate = (
  date: string,
  options: Intl.DateTimeFormatOptions = {},
) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
    timeZone: "UTC",
  }).format(dateValue(date));

export function membershipPeriods(today: string) {
  const current = dateValue(today);
  const quarterMonth = Math.floor(current.getUTCMonth() / 3) * 3;
  return [
    { id: "today", label: "Today", from: today, to: today },
    {
      id: "yesterday",
      label: "Yesterday",
      from: shiftDate(today, -1),
      to: shiftDate(today, -1),
    },
    {
      id: "last7",
      label: "Last 7 days",
      from: shiftDate(today, -6),
      to: today,
    },
    { id: "mtd", label: "Month to date", from: monthStart(today), to: today },
    {
      id: "lastMonth",
      label: "Last month",
      from: monthStart(today, -1),
      to: shiftDate(monthStart(today), -1),
    },
    {
      id: "qtd",
      label: "Quarter to date",
      from: dateKey(
        new Date(Date.UTC(current.getUTCFullYear(), quarterMonth, 1, 12)),
      ),
      to: today,
    },
    {
      id: "ytd",
      label: "Year to date",
      from: `${today.slice(0, 4)}-01-01`,
      to: today,
    },
  ];
}
