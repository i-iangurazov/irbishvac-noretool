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
  tvMode: boolean;
  kioskMode: boolean;
  rotateMode: boolean;
  apiQueryString: string;
};

export type DashboardFilterState = Pick<
  ResolvedDashboardFilters,
  "preset" | "from" | "to" | "tvMode" | "kioskMode" | "rotateMode"
>;

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseBooleanFlag(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function buildPresetHref(
  path: string,
  preset: DatePreset,
  state: boolean | DashboardFilterState = false,
) {
  if (typeof state === "boolean") {
    return `${path}?${new URLSearchParams(state ? { preset, tv: "1" } : { preset }).toString()}`;
  }

  const params = new URLSearchParams({ preset });

  if (state.tvMode) {
    params.set("tv", "1");
  }

  if (state.kioskMode) {
    params.set("kiosk", "1");
  }

  if (state.rotateMode) {
    params.set("rotate", "1");
  }

  return `${path}?${params.toString()}`;
}

export function buildDashboardQueryString(
  filters: Pick<DashboardFilterState, "preset" | "from" | "to"> &
    Partial<Pick<DashboardFilterState, "tvMode" | "kioskMode" | "rotateMode">>,
  overrides?: Partial<DashboardFilterState>,
) {
  const params = new URLSearchParams({
    preset: overrides?.preset ?? filters.preset,
    from: overrides?.from ?? filters.from,
    to: overrides?.to ?? filters.to
  });

  const tvMode = overrides?.tvMode ?? filters.tvMode ?? false;
  const kioskMode = overrides?.kioskMode ?? filters.kioskMode ?? false;
  const rotateMode = overrides?.rotateMode ?? filters.rotateMode ?? false;

  if (tvMode) {
    params.set("tv", "1");
  }

  if (kioskMode) {
    params.set("kiosk", "1");
  }

  if (rotateMode) {
    params.set("rotate", "1");
  }

  return params.toString();
}

export function buildDashboardHref(
  path: string,
  filters: Pick<DashboardFilterState, "preset" | "from" | "to"> &
    Partial<Pick<DashboardFilterState, "tvMode" | "kioskMode" | "rotateMode">>,
  overrides?: Partial<DashboardFilterState>,
) {
  return `${path}?${buildDashboardQueryString(filters, overrides)}`;
}

export function buildTvModeHref(
  path: string,
  filters: Pick<DashboardFilterState, "preset" | "from" | "to"> &
    Partial<Pick<DashboardFilterState, "tvMode" | "kioskMode" | "rotateMode">>,
  enabled: boolean,
) {
  return buildDashboardHref(path, filters, { tvMode: enabled });
}

export function buildKioskHref(
  path: string,
  filters: Pick<DashboardFilterState, "preset" | "from" | "to"> &
    Partial<Pick<DashboardFilterState, "tvMode" | "kioskMode" | "rotateMode">>,
  enabled: boolean,
) {
  return buildDashboardHref(path, filters, {
    tvMode: true,
    kioskMode: enabled
  });
}

export function buildRotationHref(
  path: string,
  filters: Pick<DashboardFilterState, "preset" | "from" | "to"> &
    Partial<Pick<DashboardFilterState, "tvMode" | "kioskMode" | "rotateMode">>,
  preset: DatePreset,
  enabled: boolean,
) {
  const params = new URLSearchParams({ preset });
  params.set("tv", "1");

  if (filters.kioskMode) {
    params.set("kiosk", "1");
  }

  if (enabled) {
    params.set("rotate", "1");
  }

  return `${path}?${params.toString()}`;
}

export async function resolveDashboardFilters(
  searchParams: DashboardSearchParams | undefined,
  timeZone: string,
): Promise<ResolvedDashboardFilters> {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const preset = parseDatePreset(takeFirst(resolvedSearchParams.preset)) ?? "mtd";
  const tvMode = parseBooleanFlag(takeFirst(resolvedSearchParams.tv));
  const kioskMode = parseBooleanFlag(takeFirst(resolvedSearchParams.kiosk));
  const rotateMode = parseBooleanFlag(takeFirst(resolvedSearchParams.rotate));
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
    tvMode,
    kioskMode,
    rotateMode,
    apiQueryString: new URLSearchParams({
      preset,
      from: range.from,
      to: range.to
    }).toString()
  };
}
