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
        className="company-goal-insert-button inline-flex items-center bg-[#0c4d5b] font-bold text-white transition hover:bg-[#0a4250]"
        onClick={() => setOpen(true)}
        type="button"
      >
        Goal Insert
      </button>

      {open ? (
        <div className="company-goal-modal fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.36)]">
          <div className="company-goal-modal__panel w-full border border-[#ece3da] bg-white">
            <div className="company-goal-modal__header flex items-start justify-between">
              <div>
                <div className="company-goal-modal__title font-black text-[#111827]">
                  Insert Monthly Goal
                </div>
                <div className="company-goal-modal__subtitle text-slate-500">
                  Update the {year} goal line for a selected month.
                </div>
              </div>
              <button
                className="company-goal-modal__close inline-flex items-center justify-center bg-[#f4f6f8] text-slate-600"
                onClick={() => setOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <form className="company-goal-modal__form grid" onSubmit={handleSubmit}>
              <label className="company-goal-modal__field-group grid">
                <span className="company-goal-modal__field-label font-bold uppercase text-slate-500">
                  Month
                </span>
                <select
                  className="company-goal-modal__field rounded border border-[#d8e0e8] bg-white text-[#111827]"
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

              <label className="company-goal-modal__field-group grid">
                <span className="company-goal-modal__field-label font-bold uppercase text-slate-500">
                  Goal Amount
                </span>
                <div className="company-goal-modal__currency-wrap relative">
                  <span className="company-goal-modal__currency pointer-events-none absolute top-1/2 -translate-y-1/2 font-bold text-slate-500">
                    $
                  </span>
                  <input
                    className="company-goal-modal__field company-goal-modal__field--currency w-full rounded border border-[#d8e0e8] bg-white text-[#111827]"
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

              <div className="company-goal-modal__summary bg-[#f8fbfd] text-slate-600">
                {selectedGoal
                  ? `Current ${selectedGoal.monthName} goal: $${selectedGoal.goalAmount.toLocaleString("en-US")}`
                  : "No goal is stored for this month yet."}
              </div>

              {error ? <div className="company-goal-modal__error font-medium text-[#d14343]">{error}</div> : null}

              <div className="company-goal-modal__actions flex items-center justify-end">
                <button
                  className="company-goal-modal__button company-goal-modal__button--secondary border border-[#d8e0e8] font-semibold text-slate-600"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="company-goal-modal__button company-goal-modal__button--primary bg-[#0c4d5b] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
