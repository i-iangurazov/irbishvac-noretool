export type DatePreset = "mtd" | "ytd" | "today" | "yesterday";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function getFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

export function getDateParts(date: Date, timeZone: string): DateParts {
  const parts = Object.fromEntries(
    getFormatter(timeZone).formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day)
  };
}

export function toBusinessDateString(date: Date, timeZone: string): string {
  const parts = getDateParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function parseDatePreset(value: string | null | undefined): DatePreset | undefined {
  if (value === "mtd" || value === "ytd" || value === "today" || value === "yesterday") {
    return value;
  }

  return undefined;
}

export function formatBusinessDateLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

export function getPresetRange(
  preset: DatePreset,
  timeZone: string,
  referenceDate = new Date(),
) {
  const today = toBusinessDateString(referenceDate, timeZone);
  const { year, month } = getDateParts(referenceDate, timeZone);

  if (preset === "today") {
    return { from: today, to: today };
  }

  if (preset === "yesterday") {
    const yesterday = toBusinessDateString(addDays(referenceDate, -1), timeZone);
    return { from: yesterday, to: yesterday };
  }

  if (preset === "ytd") {
    return {
      from: `${year}-01-01`,
      to: today
    };
  }

  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    to: today
  };
}

export function getDaysInBusinessMonth(date: Date, timeZone: string): number {
  const { year, month } = getDateParts(date, timeZone);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
