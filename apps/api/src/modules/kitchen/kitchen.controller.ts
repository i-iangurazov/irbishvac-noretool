import {
  Controller,
  Get,
  Header,
  Inject,
  Query,
  UseGuards,
} from "@nestjs/common";
import { DashboardAccessGuard } from "../dashboard/dashboard-access.guard";
import { KitchenService } from "./kitchen.service";
import { kitchenPresentationDirectory } from "./kitchen-org-display";

@Controller("dashboard/kitchen")
@UseGuards(DashboardAccessGuard)
export class KitchenController {
  constructor(
    @Inject(KitchenService) private readonly kitchen: KitchenService,
  ) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  async board(@Query("presentation") presentation?: string) {
    const board = await this.kitchen.board();
    return {
      ...board,
      directory: kitchenPresentationDirectory(board.directory, presentation),
    };
  }
}
