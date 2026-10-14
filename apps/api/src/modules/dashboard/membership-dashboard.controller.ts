import {
  BadRequestException,
  ConflictException,
  Header,
  Body,
  Headers,
  UnauthorizedException,
  NotFoundException,
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
  MEMBERSHIP_CUSTOMER_METRICS,
  membershipCustomerScopeKey,
  type MembershipCustomerMetric,
  type MembershipCustomerPage,
  type MembershipCustomerSnapshot,
  membershipScopeKey,
  resolveMembershipPeriod,
  type MembershipPerformance,
  type MembershipServiceNote,
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

  @Get("customers/:metric")
  @Header("Cache-Control", "private, no-store")
  async customers(
    @Param("metric") metric: string,
    @Query()
    query: Query & { snapshotTime?: string; page?: string; q?: string },
  ): Promise<MembershipCustomerPage> {
    const period = membershipQueryPeriod(query);
    if (
      !MEMBERSHIP_CUSTOMER_METRICS.includes(metric as MembershipCustomerMetric)
    )
      throw new BadRequestException("Invalid membership metric");
    if (
      typeof query.snapshotTime !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(query.snapshotTime) ||
      !Number.isFinite(Date.parse(query.snapshotTime))
    )
      throw new BadRequestException("A dashboard snapshot is required");
    if (
      query.page !== undefined &&
      (typeof query.page !== "string" || !/^[1-9]\d{0,5}$/.test(query.page))
    )
      throw new BadRequestException("Invalid page");
    if (
      query.q !== undefined &&
      (typeof query.q !== "string" || query.q.length > 100)
    )
      throw new BadRequestException("Search must be 100 characters or fewer");
    const page = Number(query.page ?? 1),
      pageSize = 25;
    const record = await prisma.dashboardReadModel.findUnique({
      where: {
        family_scopeKey: {
          family: DashboardFamily.CALL_CENTER_SOURCE,
          scopeKey: membershipCustomerScopeKey(period),
        },
      },
    });
    const snapshot = record?.payloadJson as unknown as
      | MembershipCustomerSnapshot
      | undefined;
    if (!snapshot) {
      await this.refresh
        .enqueueMembershipRefresh(period)
        .catch(() =>
          this.logger.warn("Could not enqueue membership customer refresh"),
        );
      return {
        state: "pending",
        count: null,
        total: 0,
        page,
        pageSize,
        rows: [],
      };
    }
    if (snapshot.snapshotTime !== query.snapshotTime)
      throw new ConflictException(
        "The dashboard has updated. Refresh to view these customers.",
      );
    const cohort = snapshot.cohorts[metric as MembershipCustomerMetric];
    const search = (query.q ?? "").trim().toLocaleLowerCase("en-US");
    const rows = cohort.rows.filter(
      (row) =>
        !search ||
        [
          row.customerName,
          row.customerId,
          row.membershipId,
          row.membershipType,
          row.soldBy,
        ].some((value) => value?.toLocaleLowerCase("en-US").includes(search)),
    );
    return {
      state: cohort.state,
      count: cohort.count,
      total: rows.length,
      page,
      pageSize,
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
    };
  }

  private async requireServiceEvent(eventId: string, query: Query) {
    if (!/^\d{1,20}$/.test(eventId))
      throw new BadRequestException("Invalid service event");
    const period = membershipQueryPeriod(query);
    const record = await prisma.dashboardReadModel.findUnique({
      where: {
        family_scopeKey: {
          family: DashboardFamily.CALL_CENTER_SOURCE,
          scopeKey: membershipScopeKey(period),
        },
      },
    });
    const data = record?.payloadJson as unknown as
      | MembershipPerformance
      | undefined;
    const found = [
      data?.recurring,
      data?.seasons?.spring,
      data?.seasons?.fall,
    ].some((cohort) => cohort?.events.some((event) => event.id === eventId));
    if (!found)
      throw new NotFoundException(
        "Service event not found in this reporting period",
      );
  }

  @Get("services/:eventId/notes")
  async serviceNotes(
    @Param("eventId") eventId: string,
    @Query() query: Query,
  ): Promise<MembershipServiceNote[]> {
    await this.requireServiceEvent(eventId, query);
    const notes = await prisma.dashboardReadModel.findMany({
      where: {
        family: DashboardFamily.CALL_CENTER_SOURCE,
        scopeKey: { startsWith: `membership-service-note:v1:${eventId}:` },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return notes.map(row => {
      const {id, body, author, createdAt}=row.payloadJson as unknown as MembershipServiceNote;
      return {id, body, author, createdAt};
    });
  }

  @Post("services/:eventId/notes")
  async addServiceNote(
    @Param("eventId") eventId: string,
    @Query() query: Query,
    @Body() body: unknown,
    @Headers("x-dashboard-user-id") authorId?: string,
    @Headers("x-dashboard-user-label") author?: string,
  ): Promise<MembershipServiceNote> {
    // Identity is supplied only by the authenticated web proxy, never by the note body.
    if (!authorId || authorId.length > 128 || !author || !(author === "Shared dashboard" || /^[^\s@]+@irbishvac\.com$/i.test(author)))
      throw new UnauthorizedException("An authorized IRBIS dashboard account is required");
    const input = body as { body?: unknown; requestId?: unknown } | null;
    if (
      typeof input?.body !== "string" ||
      !input.body.trim() ||
      input.body.trim().length > 2000 ||
      typeof input.requestId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        input.requestId,
      )
    )
      throw new BadRequestException(
        "A note of 1–2000 characters and a valid request ID are required",
      );
    await this.requireServiceEvent(eventId, query);
    const note: MembershipServiceNote = {
      id: input.requestId,
      body: input.body.trim(),
      author,
      createdAt: new Date().toISOString(),
    };
    const scopeKey = `membership-service-note:v1:${eventId}:${input.requestId}`;
    // Each immutable note is independent of ingestion and survives all source refreshes.
    const record = await prisma.dashboardReadModel.upsert({
      where: {
        family_scopeKey: {
          family: DashboardFamily.CALL_CENTER_SOURCE,
          scopeKey,
        },
      },
      create: {
        family: DashboardFamily.CALL_CENTER_SOURCE,
        scopeKey,
        sourceSnapshotIds: [],
        snapshotTime: new Date(note.createdAt),
        payloadJson: { ...note, authorId },
      },
      update: {},
    });
    const {
      id,
      body: text,
      author: name,
      createdAt,
    } = record.payloadJson as unknown as MembershipServiceNote;
    return { id, body: text, author: name, createdAt };
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
