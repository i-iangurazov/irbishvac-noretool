import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { DashboardAccessGuard } from "../dashboard/dashboard-access.guard";
import { CoachingSourceService } from "./coaching-source.service";

@Controller("dashboard/performance/coaching")
@UseGuards(DashboardAccessGuard)
export class CoachingSourceController {
  constructor(@Inject(CoachingSourceService) private readonly source: CoachingSourceService) {}
  @Get()
  get(@Query("staff") staff: string) { return this.source.forStaff(staff); }
}
