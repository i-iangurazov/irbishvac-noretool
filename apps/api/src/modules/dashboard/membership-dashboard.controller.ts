import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { DashboardFamily, prisma } from "@irbis/db";
import {
  emptyMembershipPerformance,
  membershipScopeKey,
  resolveMembershipPeriod,
  type MembershipPerformance,
} from "@irbis/domain";
import { createLogger, parseDatePreset } from "@irbis/utils";
import { DashboardAccessGuard } from "./dashboard-access.guard";
import { DashboardRefreshService } from "./dashboard-refresh.service";

type Query = { from?: string; to?: string; preset?: string };
export function membershipQueryPeriod(query: Query) {
  const preset = parseDatePreset(query.preset);
  if (query.preset && !preset)
    throw new BadRequestException("Invalid date preset");
  try {
    return resolveMembershipPeriod({
      ...(preset ? { preset } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    });
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : "Invalid date range",
    );
  }
}

@Controller("dashboard/call-center/memberships")
@UseGuards(DashboardAccessGuard)
export class MembershipDashboardController {
  private readonly logger = createLogger("api-memberships");
  constructor(
    @Inject(DashboardRefreshService)
    private readonly refresh: DashboardRefreshService,
  ) {}

  @Get()
  async getDashboard(@Query() query: Query): Promise<MembershipPerformance> {
    const period = membershipQueryPeriod(query);
    const record = await prisma.dashboardReadModel.findUnique({
      where: {
        family_scopeKey: {
          family: DashboardFamily.CALL_CENTER_SOURCE,
          scopeKey: membershipScopeKey(period),
        },
      },
    });
    if (
      !record?.snapshotTime ||
      Date.now() - record.snapshotTime.getTime() > 15 * 60_000
    ) {
      await this.refresh
        .enqueueMembershipRefresh(period)
        .catch(() => this.logger.warn("Could not enqueue membership refresh"));
    }
    return (
      (record?.payloadJson as unknown as MembershipPerformance) ??
      emptyMembershipPerformance(period)
    );
  }

  @Post("refresh")
  requestRefresh(@Query() query: Query) {
    return this.refresh.enqueueMembershipRefresh(membershipQueryPeriod(query));
  }

  @Get("refresh/:jobId")
  refreshStatus(@Param("jobId") jobId: string) {
    return this.refresh.getMembershipRefreshStatus(jobId);
  }
}
