export type CompanyTrendingMonth = {
  month: string;
  short?: string;
  previous: { sales: number; revenue: number };
  current: { sales: number; revenue: number };
  goal: number;
};

export type CompanyTrendingData = {
  years: { previous: number; current: number };
  months: CompanyTrendingMonth[];
  chartMax?: number;
  snapshotTime?: string | null;
};

/** Four equal intervals with readable monetary ticks, always covering every series and goal. */
export function companyTrendScale(data: CompanyTrendingData) {
  const largest = Math.max(
    1,
    data.chartMax ?? 0,
    ...data.months.flatMap((month) => [
      month.previous.sales,
      month.previous.revenue,
      month.current.sales,
      month.current.revenue,
      month.goal,
    ]),
  );
  const roughStep = largest / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step =
    [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 10].find(
      (value) => value >= roughStep / magnitude,
    )! * magnitude;
  const max = step * 4;
  return { max, ticks: [max, step * 3, step * 2, step, 0] };
}

/** Keep small actuals proportional; zero must never create a decorative bar. */
export function companyTrendPercent(value: number, max: number) {
  return `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
}

export function companyTrendAxisLabel(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function companyTrendTooltip(
  data: CompanyTrendingData,
  month: CompanyTrendingMonth,
  index: number,
  cutoff: string,
) {
  const [year, monthNumber, day] = cutoff.split("-").map(Number);
  const future =
    data.years.current > year! ||
    (data.years.current === year && index + 1 > monthNumber!);
  const partial =
    data.years.current === year &&
    index + 1 === monthNumber &&
    day! < new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate();
  const through = partial
    ? ` (through ${new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/Los_Angeles",
      }).format(new Date(`${cutoff}T12:00:00Z`))})`
    : "";
  const money = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  return [
    month.month,
    `${data.years.previous} Sales: ${money(month.previous.sales)}`,
    `${data.years.previous} Revenue: ${money(month.previous.revenue)}`,
    `${data.years.current} Sales${through}: ${future ? "Not started" : money(month.current.sales)}`,
    `${data.years.current} Revenue${through}: ${future ? "Not started" : money(month.current.revenue)}`,
    `${data.years.current} Monthly goal: ${money(month.goal)}`,
  ].join("\n");
}
