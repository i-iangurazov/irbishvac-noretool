import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardRefreshService } from "./dashboard-refresh.service";
import { DashboardService } from "./dashboard.service";
import { CampaignPlanningService } from "./campaign-planning.service";

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRefreshService, CampaignPlanningService],
  exports: [DashboardService, DashboardRefreshService]
})
export class DashboardModule {}
