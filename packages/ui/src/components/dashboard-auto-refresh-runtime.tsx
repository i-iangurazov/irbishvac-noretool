"use client";

import { useEffect } from "react";

type DashboardAutoRefreshRuntimeProps = {
  enabled: boolean;
  timeZone?: string | undefined;
};

type BusinessClockParts = {
  dateKey: string;
  hour: number;
};

const DEFAULT_TIME_ZONE = "America/Los_Angeles";
const DAILY_CHECK_INTERVAL_MS = 60_000;
const PERIODIC_REFRESH_INTERVAL_MS = 60 * 60_000;
const MORNING_REFRESH_HOUR = 5;
const ERROR_RECOVERY_DELAY_MS = 5_000;
const ERROR_RECOVERY_COOLDOWN_MS = 5 * 60_000;
const ERROR_RECOVERY_STORAGE_KEY = "irbis-dashboard-last-error-refresh";

const RELATIVE_PRESETS = new Set(["mtd", "ytd", "today"]);

function takePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function getBusinessClockParts(
  date: Date,
  timeZone = DEFAULT_TIME_ZONE,
): BusinessClockParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const year = takePart(parts, "year");
  const month = takePart(parts, "month");
  const day = takePart(parts, "day");
  const hour = Number(takePart(parts, "hour"));

  return {
    dateKey: `${year}-${month}-${day}`,
    hour: Number.isFinite(hour) ? hour : 0,
  };
}

export function shouldRemoveDashboardRangeParams(
  href: string,
  currentBusinessDate: string,
) {
  const url = new URL(href);
  const params = url.searchParams;
  const preset = params.get("preset") ?? "mtd";
  const to = params.get("to");

  return Boolean(
    to && RELATIVE_PRESETS.has(preset) && to !== currentBusinessDate,
  );
}

export function removeDashboardRangeParams(href: string) {
  const url = new URL(href);
  url.searchParams.delete("from");
  url.searchParams.delete("to");

  return url.toString();
}

export function DashboardAutoRefreshRuntime({
  enabled,
  timeZone = DEFAULT_TIME_ZONE,
}: DashboardAutoRefreshRuntimeProps) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let mounted = true;
    let loadedBusinessDate = getBusinessClockParts(
      new Date(),
      timeZone,
    ).dateKey;

    function refreshPage(cleanRangeParams: boolean) {
      if (!mounted) {
        return;
      }

      if (cleanRangeParams) {
        const nextHref = removeDashboardRangeParams(window.location.href);

        if (nextHref !== window.location.href) {
          window.location.replace(nextHref);
          return;
        }
      }

      window.location.reload();
    }

    function cleanStaleRangeParams() {
      const { dateKey } = getBusinessClockParts(new Date(), timeZone);

      if (shouldRemoveDashboardRangeParams(window.location.href, dateKey)) {
        window.location.replace(
          removeDashboardRangeParams(window.location.href),
        );
      }
    }

    cleanStaleRangeParams();

    const dailyCheck = window.setInterval(() => {
      const { dateKey, hour } = getBusinessClockParts(new Date(), timeZone);

      if (dateKey !== loadedBusinessDate && hour >= MORNING_REFRESH_HOUR) {
        loadedBusinessDate = dateKey;
        refreshPage(true);
      }
    }, DAILY_CHECK_INTERVAL_MS);

    const periodicRefresh = window.setInterval(() => {
      refreshPage(false);
    }, PERIODIC_REFRESH_INTERVAL_MS);

    function getLastErrorRecovery() {
      try {
        return Number(
          window.sessionStorage.getItem(ERROR_RECOVERY_STORAGE_KEY) ?? 0,
        );
      } catch {
        return 0;
      }
    }

    function setLastErrorRecovery(value: number) {
      try {
        window.sessionStorage.setItem(
          ERROR_RECOVERY_STORAGE_KEY,
          String(value),
        );
      } catch {
        // Ignore storage failures; the delayed refresh is still useful.
      }
    }

    const recoverFromClientError = (
      event: ErrorEvent | PromiseRejectionEvent,
    ) => {
      if (event.type === "error") {
        const errorEvent = event as ErrorEvent;

        if (!errorEvent.message && !errorEvent.error) {
          return;
        }
      }

      const now = Date.now();
      const lastRecovery = getLastErrorRecovery();

      if (
        Number.isFinite(lastRecovery) &&
        now - lastRecovery < ERROR_RECOVERY_COOLDOWN_MS
      ) {
        return;
      }

      setLastErrorRecovery(now);
      window.setTimeout(() => refreshPage(false), ERROR_RECOVERY_DELAY_MS);
    };

    window.addEventListener("error", recoverFromClientError);
    window.addEventListener("unhandledrejection", recoverFromClientError);

    return () => {
      mounted = false;
      window.clearInterval(dailyCheck);
      window.clearInterval(periodicRefresh);
      window.removeEventListener("error", recoverFromClientError);
      window.removeEventListener("unhandledrejection", recoverFromClientError);
    };
  }, [enabled, timeZone]);

  return null;
}
