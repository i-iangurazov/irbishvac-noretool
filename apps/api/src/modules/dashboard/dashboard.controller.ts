import { Body, Controller, Get, Headers, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { parseDatePreset } from "@irbis/utils";
import {
  DashboardService,
  type CompanyWideDashboardResponse,
  type DashboardRequestContext
} from "./dashboard.service";
import { CampaignPlanningService, type CampaignPlanningInput } from "./campaign-planning.service";
import { DashboardAccessGuard } from "./dashboard-access.guard";

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
@UseGuards(DashboardAccessGuard)
export class DashboardController {
  private readonly dashboardService: DashboardService;
  private readonly campaignPlanningService: CampaignPlanningService;

  constructor(
    @Inject(DashboardService) dashboardService: DashboardService,
    @Inject(CampaignPlanningService) campaignPlanningService: CampaignPlanningService,
  ) {
    this.dashboardService = dashboardService;
    this.campaignPlanningService = campaignPlanningService;
    this.getTechnicians = this.getTechnicians.bind(this);
    this.getPerformanceTechnicians = this.getPerformanceTechnicians.bind(this);
    this.getPlumbing = this.getPlumbing.bind(this);
    this.getElectrical = this.getElectrical.bind(this);
    this.getInstallers = this.getInstallers.bind(this);
    this.getPlumbingInstallers = this.getPlumbingInstallers.bind(this);
    this.getElectricalInstallers = this.getElectricalInstallers.bind(this);
    this.getCompanyWide = this.getCompanyWide.bind(this);
    this.getAdvisors = this.getAdvisors.bind(this);
    this.getPerformanceAdvisors = this.getPerformanceAdvisors.bind(this);
    this.getPerformanceFieldPro = this.getPerformanceFieldPro.bind(this);
    this.getCallCenterSummary = this.getCallCenterSummary.bind(this);
    this.getCallCenterByCsr = this.getCallCenterByCsr.bind(this);
    this.getLeads = this.getLeads.bind(this);
    this.getCampaigns = this.getCampaigns.bind(this);
    this.getCampaignPerformance = this.getCampaignPerformance.bind(this);
    this.getCampaignPlanningWriteStatus = this.getCampaignPlanningWriteStatus.bind(this);
    this.saveCampaignPlanningInput = this.saveCampaignPlanningInput.bind(this);
    this.refreshCampaignPerformance = this.refreshCampaignPerformance.bind(this);
    this.getCampaignPerformanceRefreshStatus = this.getCampaignPerformanceRefreshStatus.bind(this);
    this.getTrending = this.getTrending.bind(this);
  }

  @Get("technicians")
  async getTechnicians(@Query() query: DashboardQuery) {
    return this.dashboardService.getTechnicians(toRequestContext(query));
  }

  @Get("performance/technicians")
  async getPerformanceTechnicians(@Query() query: DashboardQuery) {
    return this.dashboardService.getPerformanceTechnicians(toRequestContext(query));
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

  @Get("performance/advisors")
  async getPerformanceAdvisors(@Query() query: DashboardQuery) {
    return this.dashboardService.getPerformanceAdvisors(toRequestContext(query));
  }

  @Get("performance/field-pro")
  async getPerformanceFieldPro(@Query() query: DashboardQuery) {
    return this.dashboardService.getPerformanceFieldPro(toRequestContext(query));
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

  @Get("campaigns/performance")
  async getCampaignPerformance(@Query("month") month = "2026-08") {
    return this.dashboardService.getCampaignPerformance(month);
  }

  @Post("campaigns/performance/refresh")
  async refreshCampaignPerformance(@Query("month") month = "2026-08") {
    return this.dashboardService.requestCampaignPerformanceRefresh(month);
  }

  @Post("campaigns/performance/inputs")
  async saveCampaignPlanningInput(
    @Headers("x-dashboard-write-token") writeToken: string | undefined,
    @Body() body: CampaignPlanningInput,
  ) {
    this.campaignPlanningService.assertAuthorized(writeToken);
    const saved = await this.campaignPlanningService.saveInput(body);
    const refresh = await this.dashboardService.requestCampaignPerformanceRefresh(body.month);

    return { ...saved, jobId: refresh.jobId };
  }

  @Get("campaigns/performance/inputs/status")
  async getCampaignPlanningWriteStatus() {
    return this.campaignPlanningService.getWriteStatus();
  }

  @Get("campaigns/performance/refresh/:jobId")
  async getCampaignPerformanceRefreshStatus(@Param("jobId") jobId: string) {
    return this.dashboardService.getCampaignPerformanceRefreshStatus(jobId);
  }

  @Get("trending")
  async getTrending(@Query() query: DashboardQuery) {
    return this.dashboardService.getTrending(toRequestContext(query));
  }
}
