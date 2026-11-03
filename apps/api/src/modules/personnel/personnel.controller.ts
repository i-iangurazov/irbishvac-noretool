import { timingSafeEqual } from "node:crypto";
import { getConfig } from "@irbis/config";
import { type PerformanceGoal } from "@irbis/domain";
import { PerformanceGoalsService } from "./performance-goals.service";
import { Body, Controller, Get, Headers, Inject, Post, Query, UnauthorizedException, UseGuards } from "@nestjs/common";
import { DashboardAccessGuard } from "../dashboard/dashboard-access.guard";
import { PersonnelService } from "./personnel.service";

@Controller("dashboard/personnel")
@UseGuards(DashboardAccessGuard)
export class PersonnelController {
  constructor(@Inject(PersonnelService) private readonly personnel: PersonnelService, @Inject(PerformanceGoalsService) private readonly goals: PerformanceGoalsService) {}

  @Get()
  directory(@Query("month") month?: string) {
    return this.personnel.directoryWithGoals(month);
  }
  private assertWriteAccess(token?: string) {
    const actual = Buffer.from(token ?? "");
    const expected = Buffer.from(getConfig().auth.cookieSecret);
    if (!actual.length || actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new UnauthorizedException("Performance updates require server write access");
  }
  @Post("refresh")
  refresh(@Headers("x-dashboard-write-token") token?: string, @Query("month") month?: string) {
    this.assertWriteAccess(token);
    return this.personnel.refresh(month);
  }
  @Post("goals")
  async approve(@Body() input: { sourceKey: string; approvedBy: string; goal: PerformanceGoal }, @Headers("x-dashboard-write-token") token?: string): Promise<{ id: string }> {
    this.assertWriteAccess(token);
    const saved = await this.goals.approve(input);
    return { id: saved.id };
  }
}
