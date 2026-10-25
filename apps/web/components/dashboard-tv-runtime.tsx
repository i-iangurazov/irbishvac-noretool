"use client";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { DashboardAutoRefreshRuntime } from "@irbis/ui";
/** Root placement keeps recovery alive when a rotating page fails. */
export function DashboardTvRuntime() {
  const query = useSearchParams();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  return (
    <DashboardAutoRefreshRuntime
      enabled={query.get("tv") === "1"}
      beforeRefresh={async () => {
        if (isLoaded && isSignedIn) await getToken({ skipCache: true });
      }}
    />
  );
}
