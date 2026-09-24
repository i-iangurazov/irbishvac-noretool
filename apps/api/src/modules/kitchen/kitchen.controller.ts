import { Controller, Get, Header, Inject, UseGuards } from "@nestjs/common";
import { DashboardAccessGuard } from "../dashboard/dashboard-access.guard";
import { KitchenService } from "./kitchen.service";

@Controller("dashboard/kitchen")
@UseGuards(DashboardAccessGuard)
export class KitchenController {
  constructor(
    @Inject(KitchenService) private readonly kitchen: KitchenService,
  ) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  board() {
    return this.kitchen.board();
  }
}
