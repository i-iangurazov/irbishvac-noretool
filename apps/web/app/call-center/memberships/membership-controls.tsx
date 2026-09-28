"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp, RefreshCw, Target } from "lucide-react";
import type {
  MembershipPerformance,
  MembershipRepresentative,
  MembershipDepartment,
} from "@irbis/domain";
import { CsrAvatar } from "../csr-controls";

function GoalHint({ children }: { children: string }) {
  return (
    <span className="csr-hint" tabIndex={0} aria-label={children}>
      <CircleHelp size={12} />
      <span role="tooltip">{children}</span>
    </span>
  );
}

export function MembershipRefresh({
  query,
  pending,
}: {
  query: string;
  pending: boolean;
}) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const started = useRef(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => {
        if (document.visibilityState === "visible") router.refresh();
      },
      pending || busy ? 10_000 : 60_000,
    );
    return () => window.clearInterval(timer);
  }, [router, pending, busy]);
  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    const check = async () => {
      try {
        const response = await fetch(
          `/api/dashboard/call-center/memberships/refresh/${encodeURIComponent(jobId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error();
        const { state } = await response.json();
        if (!alive) return;
        if (state === "completed") {
          setJobId(null);
          setBusy(false);
          setMessage("Updated");
          router.refresh();
        } else if (state === "failed" || state === "not-found") {
          setJobId(null);
          setBusy(false);
          setMessage("Refresh failed. Try again.");
        } else if (Date.now() - started.current > 600_000) {
          setJobId(null);
          setBusy(false);
          setMessage("Update is still queued.");
        }
      } catch {
        if (alive) {
          setJobId(null);
          setBusy(false);
          setMessage("Could not check refresh. Try again.");
        }
      }
    };
    void check();
    const timer = window.setInterval(check, 5_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [jobId, router]);
  async function refresh() {
    setBusy(true);
    setMessage("");
    started.current = Date.now();
    try {
      const response = await fetch(
        `/api/dashboard/call-center/memberships/refresh?${query}`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (result.state === "completed") {
        setBusy(false);
        setMessage("Updated");
        router.refresh();
      } else if (result.state === "failed") {
        setBusy(false);
        setMessage("Refresh failed. Try again shortly.");
      } else setJobId(result.jobId);
    } catch {
      setBusy(false);
      setMessage("Refresh failed. Try again.");
    }
  }
  return (
    <div className="membership-refresh">
      <button
        type="button"
        className="csr-button"
        onClick={refresh}
        disabled={busy}
        aria-label="Refresh membership data"
      >
        <RefreshCw size={17} className={busy ? "csr-spin" : ""} />
        {busy ? "Updating…" : "Refresh"}
      </button>
      <span role="status" aria-live="polite">
        {message}
      </span>
    </div>
  );
}

export function MembershipSalesTable({
  rows,
  goals,
  departmentLabels,
}: {
  rows: (MembershipRepresentative & { photoUrl: string | null })[];
  goals: MembershipPerformance["goals"];
  departmentLabels: Record<MembershipDepartment, string>;
}) {
  const [department, setDepartment] = useState("all");
  const [ranking, setRanking] = useState("total");
  const visible = rows
    .filter((row) => department === "all" || row.department === department)
    .sort(
      (a, b) =>
        (ranking === "new"
          ? b.newSales - a.newSales
          : ranking === "renewals"
            ? b.renewals - a.renewals
            : b.newSales + b.renewals - (a.newSales + a.renewals)) ||
        b.newSales - a.newSales ||
        a.name.localeCompare(b.name),
    );
  const goalRows = visible.filter((row) => row.goal != null);
  const total = goalRows.reduce((sum, row) => sum + row.goal!, 0),
    achieved = goalRows.reduce((sum, row) => sum + row.newSales, 0);
  const progress = total ? Math.min(100, (achieved / total) * 100) : 0;
  return (
    <section className="csr-panel membership-sales">
      <div className="membership-panel-heading">
        <h2>
          <Target size={20} />
          Sales leaderboard
        </h2>
        <div className="membership-leaderboard-filters">
          <select
            aria-label="Rank membership sales by"
            value={ranking}
            onChange={(e) => setRanking(e.target.value)}
          >
            <option value="total">Total sales</option>
            <option value="new">New sales</option>
            <option value="renewals">Renewals</option>
          </select>
          <select
            aria-label="Filter sales by department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="all">All departments</option>
            {Object.entries(departmentLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="membership-goal-summary">
        <div>
          <strong>
            {achieved.toLocaleString("en-US")}
            <span> / {total.toLocaleString("en-US")}</span>
          </strong>
          <span>
            New-sales goal · {goalRows.length} representatives{" "}
            <GoalHint>
              Only new sales by the current CSR and HVAC/Plumbing service target
              group contribute to this goal. Other sellers remain in the overall
              sales totals.
            </GoalHint>
          </span>
        </div>
        <div>
          <b>
            {total
              ? `${((achieved / total) * 100).toFixed(0)}% achieved`
              : "No goal assigned"}
          </b>
          <span>
            {Math.max(0, total - achieved).toLocaleString("en-US")} remaining ·{" "}
            {goals.monthlyPerRep} / rep / month
          </span>
        </div>
        <div
          className="membership-track"
          role="progressbar"
          aria-label="Team sales goal progress"
          aria-valuemin={0}
          aria-valuemax={total || 1}
          aria-valuenow={Math.min(achieved, total)}
          aria-valuetext={`${achieved} new sales against a goal of ${total}`}
        >
          <i style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div
        className="membership-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Representative membership sales"
      >
        <table>
          <thead>
            <tr>
              <th>Representative</th>
              <th>New sales</th>
              <th>Renewals</th>
              <th>Total</th>
              <th>
                Period goal{" "}
                <GoalHint>{`${goals.monthlyPerRep} new sales per calendar month. Partial months use the full monthly target for the current roster. Renewals are excluded.`}</GoalHint>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <tr key={row.id}>
                <td>
                  <div className="membership-person">
                    <span
                      className="membership-rank"
                      aria-label={`Rank ${index + 1}`}
                    >
                      {index + 1}
                    </span>
                    <CsrAvatar name={row.name} src={row.photoUrl} />
                    <div>
                      <b>{row.name}</b>
                      <span>{departmentLabels[row.department]}</span>
                    </div>
                  </div>
                </td>
                <td className="membership-sales-count">{row.newSales}</td>
                <td>{row.renewals}</td>
                <td className="membership-total-sales">
                  {row.newSales + row.renewals}
                </td>
                <td>
                  {row.goal == null ? (
                    <span className="membership-muted">—</span>
                  ) : (
                    <div
                      className={`membership-person-goal${row.newSales >= row.goal ? " membership-person-goal--met" : ""}`}
                    >
                      <span>
                        {((row.newSales / row.goal) * 100).toFixed(0)}%{" "}
                        <i>· {Math.max(0, row.goal - row.newSales)} left</i>
                      </span>
                      <div className="membership-track">
                        <i
                          style={{
                            width: `${Math.min(100, (row.newSales / row.goal) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <p className="membership-empty-inline">
            No representatives in this department.
          </p>
        )}
      </div>
    </section>
  );
}
