import { BadRequestException, Injectable } from "@nestjs/common";
import { getConfig } from "@irbis/config";
import {
  getGoalMonthName,
  prisma,
  setDefaultMonthlyGoalEntries,
  type GoalTrackerEntry
} from "@irbis/db";
import { getDateParts } from "@irbis/utils";

export type GoalTrackerDto = {
  id: string;
  year: number;
  monthIndex: number;
  monthName: string;
  goalAmount: number;
  createdAt: string;
  updatedAt: string;
};

function toGoalTrackerDto(entry: GoalTrackerEntry): GoalTrackerDto {
  return {
    id: entry.id,
    year: entry.year,
    monthIndex: entry.monthIndex,
    monthName: entry.monthName,
    goalAmount: Number(entry.goalAmount),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

function assertIntegerInRange(value: number, label: string, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(`${label} must be an integer between ${min} and ${max}`);
  }
}

function normalizeMonthName(monthName: string, monthIndex: number) {
  const expectedMonthName = getGoalMonthName(monthIndex);
  if (!expectedMonthName) {
    throw new BadRequestException("monthIndex must map to a calendar month");
  }

  if (monthName.trim().toLowerCase() !== expectedMonthName.toLowerCase()) {
    throw new BadRequestException(
      `monthName must match monthIndex ${monthIndex} (${expectedMonthName})`,
    );
  }

  return expectedMonthName;
}

@Injectable()
export class GoalsService {
  private readonly timezone = getConfig().app.timezone;

  private getCurrentBusinessYear() {
    return getDateParts(new Date(), this.timezone).year;
  }

  async list(year = this.getCurrentBusinessYear()): Promise<GoalTrackerDto[]> {
    assertIntegerInRange(year, "year", 2000, 2100);

    const entries = await setDefaultMonthlyGoalEntries(year);

    return entries.map(toGoalTrackerDto);
  }

  async upsert(input: {
    year: number;
    monthIndex: number;
    monthName: string;
    goalAmount: number;
  }): Promise<GoalTrackerDto> {
    assertIntegerInRange(input.year, "year", 2000, 2100);
    assertIntegerInRange(input.monthIndex, "monthIndex", 1, 12);

    const goalAmount = Number(input.goalAmount);
    if (!Number.isFinite(goalAmount) || goalAmount < 0) {
      throw new BadRequestException("goalAmount must be a non-negative number");
    }

    const monthName = normalizeMonthName(input.monthName, input.monthIndex);

    const entry = await prisma.goalTrackerEntry.upsert({
      where: {
        year_monthIndex: {
          year: input.year,
          monthIndex: input.monthIndex
        }
      },
      create: {
        year: input.year,
        monthIndex: input.monthIndex,
        monthName,
        goalAmount
      },
      update: {
        monthName,
        goalAmount
      }
    });

    return toGoalTrackerDto(entry);
  }
}
