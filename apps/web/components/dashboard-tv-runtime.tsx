"use client";
import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { DashboardAutoRefreshRuntime } from "@irbis/ui";
import { requestDashboardRecovery } from "../../../packages/ui/src/components/dashboard-recovery";
/** Root placement keeps recovery alive when a rotating page fails. */
export function DashboardTvRuntime() {
  const query = useSearchParams();
  const router = useRouter();
  const tv = query.get("tv") === "1";
  const pathname = usePathname();
  const kitchen = pathname === "/kitchen";
  const refreshData = tv || pathname === "/company-wide";
  const { getToken, isLoaded, isSignedIn } = useAuth();
  useEffect(() => {
    if (!refreshData) return;
    const timer = window.setInterval(() => {
      if (!navigator.onLine || document.visibilityState === "hidden") return;
      try {
        router.refresh();
      } catch {
        requestDashboardRecovery();
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refreshData, router]);
  return (
    <DashboardAutoRefreshRuntime
      enabled={tv || kitchen}
      beforeRefresh={async () => {
        if (kitchen)
          window.dispatchEvent(new Event("irbis:kitchen:before-reload"));
        if (isLoaded && isSignedIn) await getToken({ skipCache: true });
      }}
    />
  );
}
