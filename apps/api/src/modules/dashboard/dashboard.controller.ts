import { Controller, Get, Inject, Query } from "@nestjs/common";
import { parseDatePreset } from "@irbis/utils";
import {
  DashboardService,
  type CompanyWideDashboardResponse,
  type DashboardRequestContext
} from "./dashboard.service";

type DashboardQuery = {
  preset?: string;
  from?: string;
  to?: string;
};

function toRequestContext(query: DashboardQuery): DashboardRequestContext {
  const context: DashboardRequestContext = {};
  const preset = parseDatePreset(query?.preset);

  if (preset) {
    context.preset = preset;
  }

  if (query?.from) {
    context.from = query.from;
  }

  if (query?.to) {
    context.to = query.to;
  }

  return context;
}

@Controller("dashboard")
export class DashboardController {
  private readonly dashboardService: DashboardService;

  constructor(@Inject(DashboardService) dashboardService: DashboardService) {
    this.dashboardService = dashboardService;
    this.getTechnicians = this.getTechnicians.bind(this);
    this.getPlumbing = this.getPlumbing.bind(this);
    this.getElectrical = this.getElectrical.bind(this);
    this.getInstallers = this.getInstallers.bind(this);
    this.getPlumbingInstallers = this.getPlumbingInstallers.bind(this);
    this.getElectricalInstallers = this.getElectricalInstallers.bind(this);
    this.getCompanyWide = this.getCompanyWide.bind(this);
    this.getAdvisors = this.getAdvisors.bind(this);
    this.getCallCenterSummary = this.getCallCenterSummary.bind(this);
    this.getCallCenterByCsr = this.getCallCenterByCsr.bind(this);
    this.getLeads = this.getLeads.bind(this);
    this.getCampaigns = this.getCampaigns.bind(this);
    this.getTrending = this.getTrending.bind(this);
  }

  @Get("technicians")
  async getTechnicians(@Query() query: DashboardQuery) {
    return this.dashboardService.getTechnicians(toRequestContext(query));
  }

  @Get("plumbing")
  async getPlumbing(@Query() query: DashboardQuery) {
    return this.dashboardService.getPlumbingTechnicians(toRequestContext(query));
  }

  @Get("electrical")
  async getElectrical(@Query() query: DashboardQuery) {
    return this.dashboardService.getElectricalTechnicians(toRequestContext(query));
  }

  @Get("installers")
  async getInstallers(@Query() query: DashboardQuery) {
    return this.dashboardService.getInstallers(toRequestContext(query));
  }

  @Get("plumbing-install")
  async getPlumbingInstallers(@Query() query: DashboardQuery) {
    return this.dashboardService.getPlumbingInstallers(toRequestContext(query));
  }

  @Get("electrical-install")
  async getElectricalInstallers(@Query() query: DashboardQuery) {
    return this.dashboardService.getElectricalInstallers(toRequestContext(query));
  }

  @Get("company-wide")
  async getCompanyWide(@Query() query: DashboardQuery): Promise<CompanyWideDashboardResponse> {
    return this.dashboardService.getCompanyWide(toRequestContext(query));
  }

  @Get("advisors")
  async getAdvisors(@Query() query: DashboardQuery) {
    return this.dashboardService.getAdvisors(toRequestContext(query));
  }

  @Get("call-center/summary")
  async getCallCenterSummary(@Query() query: DashboardQuery) {
    return this.dashboardService.getCallCenterSummary(toRequestContext(query));
  }

  @Get("call-center/by-csr")
  async getCallCenterByCsr(@Query() query: DashboardQuery) {
    return this.dashboardService.getCallCenterByCsr(toRequestContext(query));
  }

  @Get("leads")
  async getLeads(@Query() query: DashboardQuery) {
    return this.dashboardService.getLeadGeneration(toRequestContext(query));
  }

  @Get("campaigns")
  async getCampaigns(@Query() query: DashboardQuery) {
    return this.dashboardService.getCampaigns(toRequestContext(query));
  }

  @Get("trending")
  async getTrending(@Query() query: DashboardQuery) {
    return this.dashboardService.getTrending(toRequestContext(query));
  }
}
