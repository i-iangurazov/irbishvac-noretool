"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type CapacityRow = {
  team: string;
  headcount: number;
  opportunitiesPerDay: number;
  planningDays: number;
};

type InputMode = "plan" | "capacity" | "forecast" | "cost";
type SaveState = "idle" | "saving" | "refreshing" | "saved" | "failed";
type WriteConnection = "checking" | "ready" | "blocked";

const SAVE_LABELS: Record<SaveState, string> = {
  idle: "Save adjustment",
  saving: "Saving",
  refreshing: "Refreshing dashboard",
  saved: "Saved",
  failed: "Try again",
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function inferredCategory(channel: string) {
  if (["Yelp", "Google LSA", "Google Ads", "Paid Social", "Radio", "Direct Mail", "Workfuel"].includes(channel)) return "paid";
  if (["Website", "GBP San Jose", "669-COOLING"].includes(channel)) return "organic";
  if (["Existing Customers", "Home Care Plan", "Hatch Campaigns", "Scheduling Pro"].includes(channel)) return "retention";
  if (["Carrier", "Now Operator"].includes(channel)) return "partner";
  return "other";
}

function inferredBudgetType(channel: string) {
  if (inferredCategory(channel) !== "paid") return "none";
  if (channel === "Direct Mail") return "prepaid";
  if (["Radio", "Workfuel"].includes(channel)) return "manual";
  return "platform";
}

export function CampaignPlanInputs(props: {
  month: string;
  cutoffDate: string;
  channels: string[];
  capacityRows: CapacityRow[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<InputMode>("plan");
  const [state, setState] = useState<SaveState>("idle");
  const [writeConnection, setWriteConnection] = useState<WriteConnection>("checking");
  const [writeConnectionReason, setWriteConnectionReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const defaultTeam = props.capacityRows[0]?.team ?? "HVAC Service";
  const defaultChannel = props.channels[0] ?? "Yelp";
  const [selectedTeam, setSelectedTeam] = useState(defaultTeam);
  const [selectedPlanChannel, setSelectedPlanChannel] = useState(defaultChannel);
  const [selectedPlanCategory, setSelectedPlanCategory] = useState(inferredCategory(defaultChannel));
  const [selectedPlanBudgetType, setSelectedPlanBudgetType] = useState(inferredBudgetType(defaultChannel));
  const [selectedCostChannel, setSelectedCostChannel] = useState(defaultChannel);
  const [selectedCostBudgetType, setSelectedCostBudgetType] = useState(inferredBudgetType(defaultChannel));
  const selectedCapacity = useMemo(
    () => props.capacityRows.find((row) => row.team === selectedTeam),
    [props.capacityRows, selectedTeam],
  );

  useEffect(() => {
    let active = true;
    void fetch("/api/dashboard/campaigns/performance/inputs/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.text()) || "Unable to verify Google Sheet access");
        return response.json() as Promise<{ writable?: boolean; reason?: string | null }>;
      })
      .then((payload) => {
        if (!active) return;
        setWriteConnection(payload.writable ? "ready" : "blocked");
        setWriteConnectionReason(payload.reason ?? null);
      })
      .catch((connectionError) => {
        if (!active) return;
        setWriteConnection("blocked");
        setWriteConnectionReason(
          connectionError instanceof Error ? connectionError.message : "Unable to verify Google Sheet access",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  async function pollRefresh(jobId: string) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      await wait(1_500);
      const response = await fetch(
        `/api/dashboard/campaigns/performance/refresh/${encodeURIComponent(jobId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error((await response.text()) || "Unable to read refresh status");
      const payload = (await response.json()) as { state?: string; failedReason?: string | null };
      if (payload.state === "completed") return;
      if (payload.state === "failed") throw new Error(payload.failedReason || "Dashboard refresh failed");
    }
    throw new Error("Dashboard refresh timed out");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (writeConnection !== "ready") return;
    setError(null);
    setState("saving");
    const form = new FormData(event.currentTarget);
    const common = {
      type: mode,
      month: props.month,
      updatedBy: String(form.get("updatedBy") ?? ""),
    };
    const body = mode === "plan"
      ? {
          ...common,
          channel: String(form.get("channel") ?? ""),
          category: String(form.get("category") ?? ""),
          qualifiedLeadGoal: Number(form.get("qualifiedLeadGoal")),
          bookedOpportunityGoal: Number(form.get("bookedOpportunityGoal")),
          approvedBudget: form.get("approvedBudget") === "" ? null : Number(form.get("approvedBudget")),
          soldAmountGoal: form.get("soldAmountGoal") === "" ? null : Number(form.get("soldAmountGoal")),
          revenueGoal: form.get("revenueGoal") === "" ? null : Number(form.get("revenueGoal")),
          budgetType: String(form.get("budgetType") ?? ""),
          approvalStatus: String(form.get("approvalStatus") ?? ""),
          notes: String(form.get("notes") ?? ""),
        }
      : mode === "capacity"
      ? {
          ...common,
          effectiveFrom: String(form.get("effectiveFrom") ?? ""),
          team: String(form.get("team") ?? ""),
          headcount: Number(form.get("headcount")),
          opportunitiesPerDay: Number(form.get("opportunitiesPerDay")),
          planningDays: Number(form.get("planningDays")),
          notes: String(form.get("notes") ?? ""),
        }
      : mode === "cost"
      ? {
          ...common,
          effectiveFrom: String(form.get("effectiveFrom") ?? ""),
          channel: String(form.get("channel") ?? ""),
          mtdSpend: Number(form.get("mtdSpend")),
          budgetType: String(form.get("budgetType") ?? ""),
          notes: String(form.get("notes") ?? ""),
        }
      : {
          ...common,
          effectiveFrom: String(form.get("effectiveFrom") ?? ""),
          channel: String(form.get("channel") ?? ""),
          qualifiedLeads: Number(form.get("qualifiedLeads")),
          bookedJobs: Number(form.get("bookedJobs")),
          spend: form.get("spend") === "" ? null : Number(form.get("spend")),
          soldAmount: form.get("soldAmount") === "" ? null : Number(form.get("soldAmount")),
          completedRevenue: form.get("completedRevenue") === "" ? null : Number(form.get("completedRevenue")),
          reason: String(form.get("reason") ?? ""),
        };

    try {
      const response = await fetch("/api/dashboard/campaigns/performance/inputs", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error((await response.text()) || `Save failed (${response.status})`);
      const result = (await response.json()) as { jobId?: string };
      if (result.jobId) {
        setState("refreshing");
        await pollRefresh(result.jobId);
      }
      setState("saved");
      router.refresh();
      window.setTimeout(() => setState("idle"), 2500);
    } catch (saveError) {
      setState("failed");
      setError(saveError instanceof Error ? saveError.message : "Unable to save adjustment");
    }
  }

  return (
    <section className="campaign-input-panel" aria-label="Campaign planning inputs">
      <div className="campaign-input-panel__heading">
        <div>
          <span>Planning controls</span>
          <h3>Set the monthly plan and record adjustments</h3>
          <p>Approved goals, capacity changes, forecasts, and MTD costs are kept as separate ledgers.</p>
        </div>
        <div className="campaign-input-mode" aria-label="Adjustment type">
          <button aria-pressed={mode === "plan"} className={mode === "plan" ? "is-active" : ""} onClick={() => setMode("plan")} type="button">Monthly plan</button>
          <button aria-pressed={mode === "capacity"} className={mode === "capacity" ? "is-active" : ""} onClick={() => setMode("capacity")} type="button">Capacity</button>
          <button aria-pressed={mode === "forecast"} className={mode === "forecast" ? "is-active" : ""} onClick={() => setMode("forecast")} type="button">Channel forecast</button>
          <button aria-pressed={mode === "cost"} className={mode === "cost" ? "is-active" : ""} onClick={() => setMode("cost")} type="button">Cost entry</button>
        </div>
      </div>

      <div className={`campaign-input-connection campaign-input-connection--${writeConnection}`}>
        <span>{writeConnection === "ready" ? "Google Sheet connected for writes" : writeConnection === "checking" ? "Checking Google Sheet write access" : "Google Sheet is read-only"}</span>
        {writeConnectionReason ? <small>{writeConnectionReason}</small> : null}
      </div>

      <form aria-disabled={writeConnection !== "ready"} className="campaign-input-form" onSubmit={save} key={mode}>
        {mode === "plan" ? (
          <>
            <label><span>Channel</span><select name="channel" onChange={(event) => { setSelectedPlanChannel(event.target.value); setSelectedPlanCategory(inferredCategory(event.target.value)); setSelectedPlanBudgetType(inferredBudgetType(event.target.value)); }} value={selectedPlanChannel}>{props.channels.map((channel) => <option key={channel}>{channel}</option>)}</select></label>
            <label><span>Category</span><select name="category" onChange={(event) => setSelectedPlanCategory(event.target.value)} value={selectedPlanCategory}><option value="paid">Paid</option><option value="organic">Organic</option><option value="retention">Retention</option><option value="partner">Partner</option><option value="other">Other</option></select></label>
            <label><span>Qualified lead goal</span><input min="0" name="qualifiedLeadGoal" required step="1" type="number" /></label>
            <label><span>Booked job goal</span><input min="0" name="bookedOpportunityGoal" required step="1" type="number" /></label>
            <label><span>Approved budget</span><input min="0" name="approvedBudget" placeholder="Optional" step="0.01" type="number" /></label>
            <label><span>Budget type</span><select name="budgetType" onChange={(event) => setSelectedPlanBudgetType(event.target.value)} value={selectedPlanBudgetType}><option value="platform">Platform</option><option value="manual">Manual</option><option value="prepaid">Prepaid</option><option value="none">None</option></select></label>
            <label><span>Sales value goal</span><input min="0" name="soldAmountGoal" placeholder="Optional" step="0.01" type="number" /></label>
            <label><span>Revenue goal</span><input min="0" name="revenueGoal" placeholder="Optional" step="0.01" type="number" /></label>
            <label><span>Plan status</span><select defaultValue="draft" name="approvalStatus"><option value="draft">Draft</option><option value="approved">Approved</option></select></label>
            <label className="campaign-input-form__wide"><span>Plan note</span><input name="notes" placeholder="Assumption, source, or approval context" type="text" /></label>
          </>
        ) : mode === "capacity" ? (
          <>
            <label><span>Team</span><select name="team" onChange={(event) => setSelectedTeam(event.target.value)} value={selectedTeam}>{props.capacityRows.map((row) => <option key={row.team}>{row.team}</option>)}</select></label>
            <label><span>Headcount</span><input defaultValue={selectedCapacity?.headcount ?? 0} key={`${selectedTeam}-headcount`} min="0" name="headcount" required step="1" type="number" /></label>
            <label><span>Opportunities / day</span><input defaultValue={selectedCapacity?.opportunitiesPerDay ?? 3} key={`${selectedTeam}-opportunities`} min="0" name="opportunitiesPerDay" required step="0.1" type="number" /></label>
            <label><span>Planning days</span><input defaultValue={selectedCapacity?.planningDays ?? 25} key={`${selectedTeam}-days`} min="1" name="planningDays" required step="1" type="number" /></label>
            <label className="campaign-input-form__wide"><span>Change note</span><input name="notes" placeholder="Example: one plumber unavailable for two weeks" type="text" /></label>
          </>
        ) : mode === "cost" ? (
          <>
            <label><span>Channel</span><select name="channel" onChange={(event) => { setSelectedCostChannel(event.target.value); setSelectedCostBudgetType(inferredBudgetType(event.target.value)); }} value={selectedCostChannel}>{props.channels.map((channel) => <option key={channel}>{channel}</option>)}</select></label>
            <label><span>MTD tracked spend</span><input min="0" name="mtdSpend" required step="0.01" type="number" /></label>
            <label><span>Budget type</span><select name="budgetType" onChange={(event) => setSelectedCostBudgetType(event.target.value)} value={selectedCostBudgetType}><option value="platform">Platform</option><option value="manual">Manual</option><option value="prepaid">Prepaid</option></select></label>
            <label className="campaign-input-form__wide"><span>Cost note</span><input name="notes" placeholder="Source, invoice, or correction context" type="text" /></label>
          </>
        ) : (
          <>
            <label><span>Channel</span><select defaultValue={defaultChannel} name="channel">{props.channels.map((channel) => <option key={channel}>{channel}</option>)}</select></label>
            <label><span>Qualified lead forecast</span><input min="0" name="qualifiedLeads" required step="1" type="number" /></label>
            <label><span>Booked opportunity forecast</span><input min="0" name="bookedJobs" required step="1" type="number" /></label>
            <label><span>Budget forecast</span><input min="0" name="spend" placeholder="Optional" step="0.01" type="number" /></label>
            <label><span>Sold amount forecast</span><input min="0" name="soldAmount" placeholder="Optional" step="0.01" type="number" /></label>
            <label><span>Revenue forecast</span><input min="0" name="completedRevenue" placeholder="Optional" step="0.01" type="number" /></label>
            <label className="campaign-input-form__wide"><span>Revision reason</span><input name="reason" placeholder="Required business reason" required type="text" /></label>
          </>
        )}
        {mode !== "plan" ? <label><span>Effective from</span><input defaultValue={props.cutoffDate} name="effectiveFrom" required type="date" /></label> : null}
        <label><span>Updated by</span><input autoComplete="name" name="updatedBy" placeholder="Name" required type="text" /></label>
        <button className="campaign-input-form__save" disabled={writeConnection !== "ready" || state === "saving" || state === "refreshing"} type="submit">{writeConnection === "blocked" ? "Editor access required" : SAVE_LABELS[state]}</button>
      </form>
      {error ? <div className="campaign-input-form__error" role="alert">{error}</div> : null}
    </section>
  );
}
