import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  private readonly healthService: HealthService;

  constructor(healthService: HealthService) {
    this.healthService = healthService;
    this.getHealth = this.getHealth.bind(this);
    this.getReadiness = this.getReadiness.bind(this);
  }

  @Get()
  getHealth() {
    return this.healthService.getLiveness();
  }

  @Get("ready")
  async getReadiness() {
    return this.healthService.getReadiness();
  }
}
