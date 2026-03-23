import {
  formatBusinessDateLabel,
  getPresetRange,
  parseDatePreset,
  type DatePreset
} from "@irbis/utils";

export type DashboardSearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

export type ResolvedDashboardFilters = {
  preset: DatePreset;
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  apiQueryString: string;
};

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function resolveDashboardFilters(
  searchParams: DashboardSearchParams | undefined,
  timeZone: string,
): Promise<ResolvedDashboardFilters> {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const preset = parseDatePreset(takeFirst(resolvedSearchParams.preset)) ?? "mtd";
  const explicitFrom = takeFirst(resolvedSearchParams.from);
  const explicitTo = takeFirst(resolvedSearchParams.to);
  const range =
    explicitFrom && explicitTo ? { from: explicitFrom, to: explicitTo } : getPresetRange(preset, timeZone);

  return {
    preset,
    from: range.from,
    to: range.to,
    fromLabel: formatBusinessDateLabel(range.from),
    toLabel: formatBusinessDateLabel(range.to),
    apiQueryString: new URLSearchParams({
      preset,
      from: range.from,
      to: range.to
    }).toString()
  };
}
