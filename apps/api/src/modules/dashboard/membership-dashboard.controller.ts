import {
  BadRequestException,
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
