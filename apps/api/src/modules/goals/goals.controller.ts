import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { GoalsService, type GoalTrackerDto } from "./goals.service";

@Controller("dashboard/goals")
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  async list(@Query("year") year?: string): Promise<GoalTrackerDto[]> {
    return this.goalsService.list(year ? Number(year) : undefined);
  }

  @Post()
  async upsert(
    @Body()
    body: {
      year: number;
      monthIndex: number;
      monthName: string;
      goalAmount: number;
    },
  ): Promise<GoalTrackerDto> {
    return this.goalsService.upsert(body);
  }
}
