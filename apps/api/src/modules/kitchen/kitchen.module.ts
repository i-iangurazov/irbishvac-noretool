import { Module } from "@nestjs/common";
import { DashboardAccessGuard } from "../dashboard/dashboard-access.guard";
import { KitchenController } from "./kitchen.controller";
import { KitchenService } from "./kitchen.service";

@Module({
  controllers: [KitchenController],
  providers: [KitchenService, DashboardAccessGuard],
})
export class KitchenModule {}
