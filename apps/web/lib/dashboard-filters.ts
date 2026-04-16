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
  rotationBoardIds: DashboardRotationBoardId[];
  apiQueryString: string;
};

export type DashboardFilterState = Pick<
  ResolvedDashboardFilters,
  "preset" | "from" | "to" | "tvMode" | "kioskMode" | "rotateMode" | "rotationBoardIds"
>;

export const DASHBOARD_ROTATION_BOARDS = [
  { id: "technicians", href: "/technicians", label: "HVAC Service" },
  { id: "plumbing", href: "/plumbing", label: "Plumbing" },
  { id: "electrical", href: "/electrical", label: "Electrical" },
  { id: "installers", href: "/installers", label: "Installers" },
  { id: "advisors", href: "/advisors", label: "Advisors" }
] as const;

export type DashboardRotationBoardId = (typeof DASHBOARD_ROTATION_BOARDS)[number]["id"];

export const DASHBOARD_ROTATION_PATHS = DASHBOARD_ROTATION_BOARDS.map((board) => board.href);

const DEFAULT_ROTATION_BOARD_IDS = DASHBOARD_ROTATION_BOARDS.map((board) => board.id);
const ROTATION_BOARD_IDS = new Set<string>(DEFAULT_ROTATION_BOARD_IDS);
const ROTATION_BOARD_ID_BY_PATH: ReadonlyMap<string, DashboardRotationBoardId> = new Map(
  DASHBOARD_ROTATION_BOARDS.map((board) => [board.href, board.id] as const),
);

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

export function supportsDashboardRotation(path: string) {
  return ROTATION_BOARD_ID_BY_PATH.has(path);
}

function uniqueRotationBoardIds(ids: string[]) {
  const seen = new Set<DashboardRotationBoardId>();

  for (const id of ids) {
    if (ROTATION_BOARD_IDS.has(id)) {
      seen.add(id as DashboardRotationBoardId);
    }
  }

  return [...seen];
}

function parseRotationBoardIds(value: string | undefined): DashboardRotationBoardId[] {
  if (!value) {
    return [...DEFAULT_ROTATION_BOARD_IDS];
  }

  const ids = uniqueRotationBoardIds(
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );

  return ids.length > 0 ? ids : [...DEFAULT_ROTATION_BOARD_IDS];
}

function isDefaultRotationBoardSelection(ids: string[] | undefined) {
  const normalized = uniqueRotationBoardIds(ids ?? DEFAULT_ROTATION_BOARD_IDS);

  return (
    normalized.length === DEFAULT_ROTATION_BOARD_IDS.length &&
    DEFAULT_ROTATION_BOARD_IDS.every((id) => normalized.includes(id))
  );
}

function setBoardsParam(params: URLSearchParams, ids: string[] | undefined) {
  if (!isDefaultRotationBoardSelection(ids)) {
    params.set("boards", uniqueRotationBoardIds(ids ?? []).join(","));
  }
}

function getRotationBoardIdForPath(path: string) {
  return ROTATION_BOARD_ID_BY_PATH.get(path) ?? null;
}

export function getDashboardRotationNavItems<T extends { href: string; id?: string }>(
  items: T[],
  selectedBoardIds?: string[],
) {
  const selectedIds = uniqueRotationBoardIds(selectedBoardIds ?? DEFAULT_ROTATION_BOARD_IDS);

  return items.filter((item) => {
    const boardId =
      item.id && ROTATION_BOARD_IDS.has(item.id)
        ? (item.id as DashboardRotationBoardId)
        : getRotationBoardIdForPath(item.href);

    return Boolean(boardId && selectedIds.includes(boardId));
  });
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

  setBoardsParam(params, state.rotationBoardIds);

  return `${path}?${params.toString()}`;
}

export function buildDashboardQueryString(
  filters: Pick<DashboardFilterState, "preset" | "from" | "to"> &
    Partial<Pick<DashboardFilterState, "tvMode" | "kioskMode" | "rotateMode" | "rotationBoardIds">>,
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
  const rotationBoardIds = overrides?.rotationBoardIds ?? filters.rotationBoardIds;

  if (tvMode) {
    params.set("tv", "1");
  }

  if (kioskMode) {
    params.set("kiosk", "1");
  }

  if (rotateMode) {
    params.set("rotate", "1");
  }

  setBoardsParam(params, rotationBoardIds);

  return params.toString();
}

export function buildDashboardHref(
  path: string,
  filters: Pick<DashboardFilterState, "preset" | "from" | "to"> &
    Partial<Pick<DashboardFilterState, "tvMode" | "kioskMode" | "rotateMode" | "rotationBoardIds">>,
  overrides?: Partial<DashboardFilterState>,
) {
  return `${path}?${buildDashboardQueryString(filters, overrides)}`;
}

export function buildTvModeHref(
  path: string,
  filters: Pick<DashboardFilterState, "preset" | "from" | "to"> &
    Partial<Pick<DashboardFilterState, "tvMode" | "kioskMode" | "rotateMode" | "rotationBoardIds">>,
  enabled: boolean,
) {
  return buildDashboardHref(path, filters, { tvMode: enabled });
}

export function buildKioskHref(
  path: string,
  filters: Pick<DashboardFilterState, "preset" | "from" | "to"> &
    Partial<Pick<DashboardFilterState, "tvMode" | "kioskMode" | "rotateMode" | "rotationBoardIds">>,
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
    Partial<Pick<DashboardFilterState, "tvMode" | "kioskMode" | "rotateMode" | "rotationBoardIds">>,
  preset: DatePreset,
  enabled: boolean,
) {
  if (!supportsDashboardRotation(path)) {
    return buildDashboardHref(path, filters, {
      preset,
      tvMode: true,
      rotateMode: false
    });
  }

  const params = new URLSearchParams({ preset });
  params.set("tv", "1");

  if (filters.kioskMode) {
    params.set("kiosk", "1");
  }

  if (enabled) {
    params.set("rotate", "1");
  }

  setBoardsParam(params, filters.rotationBoardIds);

  return `${path}?${params.toString()}`;
}

export function buildRotationBoardHref(
  path: string,
  filters: Pick<DashboardFilterState, "preset" | "from" | "to" | "kioskMode" | "rotationBoardIds">,
  boardId: DashboardRotationBoardId | "all",
) {
  const currentIds = uniqueRotationBoardIds(filters.rotationBoardIds);
  const nextIds =
    boardId === "all"
      ? [...DEFAULT_ROTATION_BOARD_IDS]
      : currentIds.includes(boardId)
        ? currentIds.length > 1
          ? currentIds.filter((id) => id !== boardId)
          : currentIds
        : [...currentIds, boardId];
  const params = new URLSearchParams({
    preset: filters.preset,
    from: filters.from,
    to: filters.to
  });
  params.set("tv", "1");
  params.set("rotate", "1");

  if (filters.kioskMode) {
    params.set("kiosk", "1");
  }

  setBoardsParam(params, nextIds);

  return `${path}?${params.toString()}`;
}

export async function resolveDashboardFilters(
  searchParams: DashboardSearchParams | undefined,
  timeZone: string,
  path?: string,
): Promise<ResolvedDashboardFilters> {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const preset = parseDatePreset(takeFirst(resolvedSearchParams.preset)) ?? "mtd";
  const tvMode = parseBooleanFlag(takeFirst(resolvedSearchParams.tv));
  const kioskMode = parseBooleanFlag(takeFirst(resolvedSearchParams.kiosk));
  const rotateRequested = parseBooleanFlag(takeFirst(resolvedSearchParams.rotate));
  const rotateMode = path && !supportsDashboardRotation(path) ? false : rotateRequested;
  const rotationBoardIds = parseRotationBoardIds(takeFirst(resolvedSearchParams.boards));
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
    rotationBoardIds,
    apiQueryString: new URLSearchParams({
      preset,
      from: range.from,
      to: range.to
    }).toString()
  };
}
