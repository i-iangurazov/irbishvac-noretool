"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

type GoalRow = {
  monthIndex: number;
  monthName: string;
  goalAmount: number;
};

type CompanyWideGoalInsertButtonProps = {
  year: number;
  goals: GoalRow[];
};

export function CompanyWideGoalInsertButton({
  year,
  goals
}: CompanyWideGoalInsertButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [monthIndex, setMonthIndex] = useState(goals[0]?.monthIndex ?? 1);
  const [amount, setAmount] = useState(() => String(goals[0]?.goalAmount ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.monthIndex === monthIndex) ?? null,
    [goals, monthIndex],
  );

  function handleMonthChange(nextMonthIndex: number) {
    setMonthIndex(nextMonthIndex);
    const existing = goals.find((goal) => goal.monthIndex === nextMonthIndex);
    setAmount(existing ? String(existing.goalAmount) : "");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const monthName = MONTH_NAMES[monthIndex - 1];
    const goalAmount = Number(amount);

    if (!monthName) {
      setError("Select a valid month.");
      return;
    }

    if (!Number.isFinite(goalAmount) || goalAmount < 0) {
      setError("Goal amount must be a non-negative number.");
      return;
    }

    try {
      const response = await fetch("/api/dashboard/goals", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          year,
          monthIndex,
          monthName,
          goalAmount
        })
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(responseText || "Failed to save goal");
      }

      setOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to save goal",
      );
    }
  }

  return (
    <>
      <button
        className="company-goal-insert-button inline-flex items-center rounded-[0.8rem] bg-[#0c4d5b] px-4 py-2 text-[0.85rem] font-bold text-white shadow-[0_10px_20px_rgba(12,77,91,0.18)] transition hover:bg-[#0a4250]"
        onClick={() => setOpen(true)}
        type="button"
      >
        Goal Insert
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.36)] p-4">
          <div className="w-full max-w-md rounded-[1.1rem] border border-[#ece3da] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[1rem] font-black text-[#111827]">Insert Monthly Goal</div>
                <div className="mt-1 text-sm text-slate-500">
                  Update the {year} goal line for a selected month.
                </div>
              </div>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f6f8] text-slate-600"
                onClick={() => setOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
              <label className="grid gap-2">
                <span className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Month
                </span>
                <select
                  className="rounded-[0.8rem] border border-[#d8e0e8] bg-white px-3 py-2.5 text-sm text-[#111827]"
                  onChange={(event) => handleMonthChange(Number(event.target.value))}
                  value={monthIndex}
                >
                  {MONTH_NAMES.map((monthName, index) => (
                    <option key={monthName} value={index + 1}>
                      {monthName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Goal Amount
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                    $
                  </span>
                  <input
                    className="w-full rounded-[0.8rem] border border-[#d8e0e8] bg-white py-2.5 pl-7 pr-3 text-sm text-[#111827]"
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                    value={amount}
                  />
                </div>
              </label>

              <div className="rounded-[0.8rem] bg-[#f8fbfd] px-3 py-3 text-sm text-slate-600">
                {selectedGoal
                  ? `Current ${selectedGoal.monthName} goal: $${selectedGoal.goalAmount.toLocaleString("en-US")}`
                  : "No goal is stored for this month yet."}
              </div>

              {error ? <div className="text-sm font-medium text-[#d14343]">{error}</div> : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  className="rounded-[0.8rem] border border-[#d8e0e8] px-4 py-2 text-sm font-semibold text-slate-600"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-[0.8rem] bg-[#0c4d5b] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? "Saving..." : "Save Goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
