import type { GoalTrackerEntry } from "@prisma/client";
import { prisma } from "./client";

export const DEFAULT_MONTHLY_GOAL_AMOUNT = 2_000_000;

export const MONTH_NAMES = [
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

export function getGoalMonthName(monthIndex: number) {
  return MONTH_NAMES[monthIndex - 1] ?? null;
}

export async function setDefaultMonthlyGoalEntries(
  year: number,
  goalAmount = DEFAULT_MONTHLY_GOAL_AMOUNT,
): Promise<GoalTrackerEntry[]> {
  const entries = await Promise.all(
    MONTH_NAMES.map((monthName, index) => {
      const monthIndex = index + 1;

      return prisma.goalTrackerEntry.upsert({
        where: {
          year_monthIndex: {
            year,
            monthIndex
          }
        },
        create: {
          year,
          monthIndex,
          monthName,
          goalAmount
        },
        update: {
          monthName,
          goalAmount
        }
      });
    }),
  );

  return entries.sort((left, right) => left.monthIndex - right.monthIndex);
}
