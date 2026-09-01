import { Module } from "@nestjs/common";
import { GoalsController } from "./goals.controller";
import { GoalsService } from "./goals.service";
import { DashboardAccessGuard } from "../dashboard/dashboard-access.guard";

@Module({
  controllers: [GoalsController],
  providers: [GoalsService, DashboardAccessGuard],
  exports: [GoalsService]
})
export class GoalsModule {}
