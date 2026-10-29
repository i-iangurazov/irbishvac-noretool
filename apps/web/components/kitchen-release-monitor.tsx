"use client";
import { useEffect, useRef } from "react";
import { requestDashboardRecovery } from "../../../packages/ui/src/components/dashboard-recovery";

/** A data refresh does not replace old JS/CSS. Confirm a changed release twice,
 * then use the existing authenticated, reachable-page recovery mechanism.
 */
export function KitchenReleaseMonitor({
  currentVersion,
  beforeReload,
}: {
  currentVersion: string | null;
  beforeReload: () => void;
}) {
  const loadedVersion = useRef(currentVersion).current;
  const prepare = useRef(beforeReload);
  prepare.current = beforeReload;
  useEffect(() => {
    const save = () => prepare.current();
    window.addEventListener("irbis:kitchen:before-reload", save);
    return () =>
      window.removeEventListener("irbis:kitchen:before-reload", save);
  }, []);
  useEffect(() => {
    if (!loadedVersion) return;
    let alive = true,
      busy = false,
      candidate: string | null = null,
      requested = false;
    let controller: AbortController | null = null;
    async function check() {
      if (
        !alive ||
        busy ||
        requested ||
        !navigator.onLine ||
        document.visibilityState === "hidden"
      )
        return;
      busy = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 5000);
      try {
        const response = await fetch("/api/kitchen/release", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("application/json")
        )
          throw Error("Release unavailable");
        const { version } = await response.json();
        if (!alive) return;
        if (
          typeof version !== "string" ||
          !/^[a-zA-Z0-9_-]{1,128}$/.test(version) ||
          version === loadedVersion
        ) {
          candidate = null;
          return;
        }
        if (candidate === version) {
          requested = true;
          prepare.current();
          requestDashboardRecovery();
        } else candidate = version;
      } catch {
        candidate = null;
      } finally {
        window.clearTimeout(timeout);
        busy = false;
      }
    }
    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    const visible = () => {
      if (document.visibilityState !== "hidden") void check();
    };
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [loadedVersion]);
  return null;
}
