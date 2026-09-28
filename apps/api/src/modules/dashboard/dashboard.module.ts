import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardRefreshService } from "./dashboard-refresh.service";
import { DashboardService } from "./dashboard.service";
import { CampaignPlanningService } from "./campaign-planning.service";
import { DashboardAccessGuard } from "./dashboard-access.guard";
import { MembershipDashboardController } from "./membership-dashboard.controller";

@Module({
  controllers: [DashboardController, MembershipDashboardController],
  providers: [DashboardService, DashboardRefreshService, CampaignPlanningService, DashboardAccessGuard],
  exports: [DashboardService, DashboardRefreshService]
})
export class DashboardModule {}
