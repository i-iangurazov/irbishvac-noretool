"use client";
import { useEffect, useRef } from "react";
import {
  createDashboardRecovery,
  DASHBOARD_CHECK_INTERVAL_MS,
  DASHBOARD_READY_EVENT,
  DASHBOARD_RECOVERY_EVENT,
  DASHBOARD_RECOVERY_STORAGE_KEY,
  getBusinessClockParts,
  shouldRemoveDashboardRangeParams,
} from "./dashboard-recovery";
export {
  getBusinessClockParts,
  shouldRemoveDashboardRangeParams,
  removeDashboardRangeParams,
} from "./dashboard-recovery";

export function DashboardAutoRefreshRuntime({
  enabled,
  timeZone = "America/Los_Angeles",
  beforeRefresh,
}: {
  enabled: boolean;
  timeZone?: string | undefined;
  beforeRefresh?: (() => Promise<unknown>) | undefined;
}) {
  const refresh = useRef(beforeRefresh);
  refresh.current = beforeRefresh;
  useEffect(() => {
    if (!enabled) return;
    const recovery = createDashboardRecovery(
      {
        href: () => window.location.href,
        now: () => Date.now(),
        online: () => navigator.onLine,
        visible: () => document.visibilityState !== "hidden",
        replace: (href) => window.location.replace(href),
        readState: () =>
          window.sessionStorage.getItem(DASHBOARD_RECOVERY_STORAGE_KEY),
        writeState: (value) =>
          window.sessionStorage.setItem(DASHBOARD_RECOVERY_STORAGE_KEY, value),
        beforeRefresh: () => refresh.current?.() ?? Promise.resolve(),
        canRefresh: async () => {
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 4_000);
          try {
            const response = await fetch("/healthz", {
              cache: "no-store",
              credentials: "omit",
              redirect: "error",
              signal: controller.signal,
            });
            return (
              response.ok &&
              response.headers
                .get("content-type")
                ?.includes("application/json") === true &&
              (await response.json()).ok === true
            );
          } catch {
            return false;
          } finally {
            window.clearTimeout(timeout);
          }
        },
      },
      timeZone,
    );
    const requestRecovery = (event: Event) => {
      const detail = (event as CustomEvent<{ targetHref?: string }>).detail;
      recovery.recover(detail?.targetHref);
    };
    const clientError = (event: Event) => {
      if (event.type === "error") {
        const error = event as ErrorEvent;
        if (!error.message && !error.error) return;
      }
      recovery.recover();
    };
    const healthy = () => recovery.markHealthy();
    const visible = () => recovery.onVisible();
    const online = () => recovery.onOnline();
    window.addEventListener(DASHBOARD_RECOVERY_EVENT, requestRecovery);
    window.addEventListener(DASHBOARD_READY_EVENT, healthy);
    window.addEventListener("error", clientError);
    window.addEventListener("unhandledrejection", clientError);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    const clock = window.setInterval(
      () => recovery.checkClock(),
      DASHBOARD_CHECK_INTERVAL_MS,
    );
    const date = getBusinessClockParts(new Date(), timeZone).dateKey;
    if (shouldRemoveDashboardRangeParams(window.location.href, date))
      recovery.recover();
    return () => {
      recovery.dispose();
      window.clearInterval(clock);
      window.removeEventListener(DASHBOARD_RECOVERY_EVENT, requestRecovery);
      window.removeEventListener(DASHBOARD_READY_EVENT, healthy);
      window.removeEventListener("error", clientError);
      window.removeEventListener("unhandledrejection", clientError);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [enabled, timeZone]);
  return null;
}
