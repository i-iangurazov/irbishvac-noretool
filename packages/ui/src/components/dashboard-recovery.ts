export const DASHBOARD_RECOVERY_EVENT = "irbis:dashboard-recovery";
export const DASHBOARD_READY_EVENT = "irbis:dashboard-ready";
export const DASHBOARD_RECOVERY_STORAGE_KEY = "irbis-dashboard-recovery:v1";
export const DASHBOARD_CHECK_INTERVAL_MS = 60_000;
const PERIODIC_REFRESH_MS = 60 * 60_000;
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];

export function getBusinessClockParts(
  date: Date,
  timeZone = "America/Los_Angeles",
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    dateKey: `${part("year")}-${part("month")}-${part("day")}`,
    hour: Number(part("hour")),
  };
}

export function shouldRemoveDashboardRangeParams(
  href: string,
  businessDate: string,
) {
  const params = new URL(href).searchParams;
  return (
    params.get("range") !== "fixed" &&
    ["mtd", "ytd", "today"].includes(params.get("preset") ?? "mtd") &&
    Boolean(params.get("to") && params.get("to") !== businessDate)
  );
}

export function removeDashboardRangeParams(href: string) {
  const url = new URL(href);
  for (const name of ["from", "to", "range"]) url.searchParams.delete(name);
  return url.toString();
}

export type DashboardRecoveryHost = {
  href: () => string;
  now: () => number;
  online: () => boolean;
  visible: () => boolean;
  replace: (href: string) => void;
  readState: () => string | null;
  writeState: (value: string) => void;
  beforeRefresh?: (() => Promise<unknown>) | undefined;
  canRefresh?: (() => Promise<boolean>) | undefined;
};

/** One controller lives above route boundaries, including while a page fails. */
export function createDashboardRecovery(
  host: DashboardRecoveryHost,
  timeZone = "America/Los_Angeles",
) {
  let disposed = false;
  let inFlight = false;
  let waiting = false;
  let pendingTarget: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let authTimer: ReturnType<typeof setTimeout> | undefined;
  let healthTimer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let clockRefreshPending = false;
  let businessDate = getBusinessClockParts(
    new Date(host.now()),
    timeZone,
  ).dateKey;
  let nextPeriodicAt = host.now() + PERIODIC_REFRESH_MS;
  let hiddenAt: number | null = host.visible() ? null : host.now();

  function state() {
    try {
      const value = JSON.parse(host.readState() ?? "null") as {
        at?: number;
        attempt?: number;
      } | null;
      const age = host.now() - Number(value?.at);
      if (value && age >= 0 && age < 10 * 60_000)
        return {
          at: Number(value.at),
          attempt: Math.min(3, Math.max(0, Number(value.attempt) || 0)),
        };
    } catch {
      /* Storage is optional on managed displays. */
    }
    return { at: 0, attempt: 0 };
  }
  function save(value: { at: number; attempt: number } | null) {
    try {
      host.writeState(JSON.stringify(value));
    } catch {
      /* Keep recovering without storage. */
    }
  }
  function target() {
    const current = new URL(host.href());
    let next = current;
    try {
      const candidate = new URL(pendingTarget ?? current.href, current);
      if (candidate.origin === current.origin) next = candidate;
    } catch {
      /* An invalid recovery target cannot change the destination. */
    }
    const date = getBusinessClockParts(new Date(host.now()), timeZone).dateKey;
    return shouldRemoveDashboardRangeParams(next.href, date)
      ? removeDashboardRangeParams(next.href)
      : next.href;
  }
  async function perform() {
    timer = undefined;
    if (disposed || inFlight) return;
    if (!host.online() || !host.visible()) {
      waiting = true;
      return;
    }
    waiting = false;
    inFlight = true;
    const attemptGeneration = generation;
    const previous = state();
    save({ at: host.now(), attempt: Math.min(3, previous.attempt + 1) });
    if (host.canRefresh) {
      const reachable = await Promise.race([
        Promise.resolve()
          .then(host.canRefresh)
          .catch(() => false),
        new Promise<boolean>((resolve) => {
          healthTimer = setTimeout(() => resolve(false), 5_000);
        }),
      ]);
      clearTimeout(healthTimer);
      healthTimer = undefined;
      if (disposed || generation !== attemptGeneration) return;
      if (!reachable) {
        // Keep this document alive: an unreachable reload would lose its recovery JavaScript.
        inFlight = false;
        recover();
        return;
      }
    }
    try {
      await Promise.race([
        Promise.resolve()
          .then(() => host.beforeRefresh?.())
          .catch(() => undefined),
        new Promise((resolve) => {
          authTimer = setTimeout(resolve, 5_000);
        }),
      ]);
    } finally {
      clearTimeout(authTimer);
      authTimer = undefined;
      if (!disposed && generation === attemptGeneration) host.replace(target());
    }
  }
  function recover(href?: string) {
    if (disposed || inFlight) return;
    if (href) pendingTarget = href;
    waiting = true;
    if (timer || !host.online() || !host.visible()) return;
    const previous = state();
    const delay = Math.max(
      5_000,
      previous.at + RETRY_DELAYS_MS[previous.attempt]! - host.now(),
    );
    timer = setTimeout(() => {
      void perform();
    }, delay);
  }
  function markHealthy() {
    if (disposed) return;
    // A normal SPA transition must not postpone midnight/hourly maintenance.
    if (
      clockRefreshPending ||
      shouldRemoveDashboardRangeParams(
        host.href(),
        getBusinessClockParts(new Date(host.now()), timeZone).dateKey,
      )
    )
      return;
    generation++;
    clearTimeout(timer);
    timer = undefined;
    pendingTarget = undefined;
    waiting = false;
    inFlight = false;
    save(null);
  }
  function checkClock() {
    if (disposed) return;
    const now = host.now();
    const date = getBusinessClockParts(new Date(now), timeZone).dateKey;
    if (date !== businessDate || now >= nextPeriodicAt) {
      clockRefreshPending = true;
      businessDate = date;
      nextPeriodicAt = now + PERIODIC_REFRESH_MS;
      recover();
    }
  }
  function onVisible() {
    if (!host.visible()) {
      hiddenAt = host.now();
      return;
    }
    const slept = hiddenAt !== null && host.now() - hiddenAt >= 60_000;
    hiddenAt = null;
    checkClock();
    if (slept || waiting) recover();
  }
  function onOnline() {
    if (host.online()) {
      checkClock();
      recover();
    }
  }
  function dispose() {
    disposed = true;
    generation++;
    clearTimeout(timer);
    clearTimeout(authTimer);
    clearTimeout(healthTimer);
  }
  return { recover, markHealthy, checkClock, onVisible, onOnline, dispose };
}

export function requestDashboardRecovery(targetHref?: string) {
  window.dispatchEvent(
    new CustomEvent(DASHBOARD_RECOVERY_EVENT, { detail: { targetHref } }),
  );
}
