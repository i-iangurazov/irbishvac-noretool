import { PerformanceGoalsService } from "../personnel/performance-goals.service";
import { PersonnelService } from "../personnel/personnel.service";
import { CoachingSourceService } from "../personnel/coaching-source.service";
import { CoachingSourceController } from "../personnel/coaching-source.controller";
import { PersonnelController } from "../personnel/personnel.controller";
import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardRefreshService } from "./dashboard-refresh.service";
import { DashboardService } from "./dashboard.service";
import { CampaignPlanningService } from "./campaign-planning.service";
import { DashboardAccessGuard } from "./dashboard-access.guard";
import { MembershipDashboardController } from "./membership-dashboard.controller";

@Module({
  controllers: [CoachingSourceController, PersonnelController, DashboardController, MembershipDashboardController],
  providers: [CoachingSourceService, PerformanceGoalsService, PersonnelService, DashboardService, DashboardRefreshService, CampaignPlanningService, DashboardAccessGuard],
  exports: [DashboardService, DashboardRefreshService]
})
export class DashboardModule {}
