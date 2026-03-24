import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { GoalsService, type GoalTrackerDto } from "./goals.service";

@Controller("dashboard/goals")
export class GoalsController {
  private readonly goalsService: GoalsService;

  constructor(@Inject(GoalsService) goalsService: GoalsService) {
    this.goalsService = goalsService;
    this.list = this.list.bind(this);
    this.upsert = this.upsert.bind(this);
  }

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
