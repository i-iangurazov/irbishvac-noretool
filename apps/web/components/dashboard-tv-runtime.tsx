"use client";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { DashboardAutoRefreshRuntime } from "@irbis/ui";
import { requestDashboardRecovery } from "../../../packages/ui/src/components/dashboard-recovery";
/** Root placement keeps recovery alive when a rotating page fails. */
export function DashboardTvRuntime() {
  const query = useSearchParams();
  const router = useRouter();
  const tv = query.get("tv") === "1";
  const { getToken, isLoaded, isSignedIn } = useAuth();
  useEffect(() => {
    if (!tv) return;
    const timer = window.setInterval(() => {
      if (!navigator.onLine || document.visibilityState === "hidden") return;
      try {
        router.refresh();
      } catch {
        requestDashboardRecovery();
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [tv, router]);
  return (
    <DashboardAutoRefreshRuntime
      enabled={tv}
      beforeRefresh={async () => {
        if (isLoaded && isSignedIn) await getToken({ skipCache: true });
      }}
    />
  );
}
