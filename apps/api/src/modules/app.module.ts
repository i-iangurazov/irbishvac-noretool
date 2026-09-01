import { Module } from "@nestjs/common";
import { DashboardModule } from "./dashboard/dashboard.module";
import { GoalsModule } from "./goals/goals.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [HealthModule, DashboardModule, GoalsModule]
})
export class AppModule {}
