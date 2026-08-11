"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RefreshState = "idle" | "queued" | "running" | "succeeded" | "failed";

const LABELS: Record<RefreshState, string> = {
  idle: "Refresh data",
  queued: "Queued",
  running: "Refreshing",
  succeeded: "Updated",
  failed: "Refresh failed"
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function CampaignRefreshButton({ month, enabled }: { month: string; enabled: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<RefreshState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    setState("queued");
    try {
      const response = await fetch(`/api/dashboard/campaigns/performance/refresh?month=${month}`, {
        method: "POST",
        headers: { accept: "application/json" }
      });
      if (!response.ok) {
        throw new Error((await response.text()) || `Refresh request failed (${response.status})`);
      }
      const request = (await response.json()) as { jobId?: string };
      if (!request.jobId) throw new Error("Refresh queue did not return a job id");

      for (let attempt = 0; attempt < 80; attempt += 1) {
        await wait(1_500);
        const statusResponse = await fetch(`/api/dashboard/campaigns/performance/refresh/${encodeURIComponent(request.jobId)}`, {
          cache: "no-store"
        });
        if (!statusResponse.ok) {
          throw new Error((await statusResponse.text()) || "Unable to read refresh status");
        }
        const status = (await statusResponse.json()) as { state?: string; failedReason?: string | null };
        if (status.state === "completed") {
          setState("succeeded");
          router.refresh();
          window.setTimeout(() => setState("idle"), 2_500);
          return;
        }
        if (status.state === "failed") {
          throw new Error(status.failedReason || "Campaign refresh failed");
        }
        setState(status.state === "active" ? "running" : "queued");
      }
      throw new Error("Refresh timed out after two minutes");
    } catch (refreshError) {
      setState("failed");
      setError(refreshError instanceof Error ? refreshError.message : "Campaign refresh failed");
    }
  }

  return (
    <div className="campaign-refresh">
      <button
        aria-busy={state === "queued" || state === "running"}
        className={`campaign-refresh__button campaign-refresh__button--${state}`}
        disabled={!enabled || state === "queued" || state === "running"}
        onClick={refresh}
        title={enabled ? "Refresh Google Sheet and ServiceTitan actuals" : "Historical months are locked"}
        type="button"
      >
        <span aria-hidden="true" className="campaign-refresh__icon">↻</span>
        {LABELS[state]}
      </button>
      {error ? <span className="campaign-refresh__error" role="alert">{error}</span> : null}
    </div>
  );
}
