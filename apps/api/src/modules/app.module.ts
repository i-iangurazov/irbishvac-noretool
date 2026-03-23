import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { GoalsModule } from "./goals/goals.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [HealthModule, AuthModule, DashboardModule, GoalsModule]
})
export class AppModule {}
