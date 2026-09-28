import { getConfig } from "@irbis/config";
import { DashboardFamily, Prisma, prisma } from "@irbis/db";
import {
  buildCsrPerformanceDashboard,
  buildMembershipPerformance,
  membershipScopeKey,
  resolveMembershipPeriod,
  resolveTabularReport,
  type MembershipPeriod,
} from "@irbis/domain";
import {
  MembershipSourceClient,
  ServiceTitanClient,
  type ReportParameter,
  type ReportRequestContext,
} from "@irbis/integrations";
import { createLogger } from "@irbis/utils";

const logger = createLogger("worker-memberships");
type Row = Record<string, unknown>;

export function membershipReportRows(
  payload: unknown,
  required: string[],
): Row[] {
  const report = resolveTabularReport(payload);
  const total = (payload as { totalCount?: number })?.totalCount;
  if (
    (payload as { hasMore?: boolean })?.hasMore ||
    (typeof total === "number" && total !== report.rows.length) ||
    required.some((key) => !report.fields.some((field) => field.name === key))
  )
    throw new Error("Membership report schema is incomplete");
  return report.rows;
}

export class MembershipPerformanceRunner {
  private readonly client = new ServiceTitanClient();
  private readonly resources = new MembershipSourceClient(this.client);

  async refresh(
    context: Pick<ReportRequestContext, "from" | "to" | "preset"> = {},
    correlationId = "membership-refresh",
  ) {
    const period = resolveMembershipPeriod(context);
    const config = getConfig().membership;
    const range: ReportParameter[] = [
      { name: "From", value: period.from },
      { name: "To", value: period.to },
    ];
    const report = async (
      category: string,
      reportId: string,
      parameters: ReportParameter[],
      required: string[],
    ) => {
      const response = await this.client.fetchPaginatedReport({
        family: "callCenterByCsr",
        category,
        reportId,
        parameters,
        correlationId,
        pageSize: 5000,
        retryRateLimits: true,
      });
      return membershipReportRows(response.payload, required);
    };
    const optional = async <T>(
      name: string,
      operation: () => Promise<T>,
    ): Promise<T | null> => {
      try {
        return await operation();
      } catch (error) {
        logger.warn("Membership source unavailable", {
          source: name,
          errorType: error instanceof Error ? error.name : "Error",
          ...period,
        });
        return null;
      }
    };
    // Separate report calls: ServiceTitan limits report execution independently of REST reads.
    const summaryRows = await optional("summary", () =>
      report(
        "other",
        config.summaryReportId,
        [...range, { name: "IncludeInactiveMembershipTypes", value: true }],
        ["Name", "ActiveAtStart", "ActiveAtEnd", "Canceled"],
      ),
    );
    const salesRows = await optional("sales", () =>
      report("sold-by", config.salesReportId, range, [
        "SoldBy",
        "SoldOn",
        "ActivationMethod",
      ]),
    );
    const recurringRows = await optional("recurring", () =>
      report(
        "operations",
        config.recurringReportId,
        [...range, { name: "FilterBy", value: 0 }],
        [
          "RecurringServiceEventId",
          "RecurringEventDate",
          "RecurringServiceName",
          "Status",
        ],
      ),
    );
    const membershipDetails = await optional("renewal-dates", () =>
      report(
        "operations",
        config.detailsReportId,
        [],
        ["CustomerMembershipId", "SoldOn"],
      ),
    );
    const [memberships, employees, technicians, businessUnits, csr] =
      await Promise.all([
        optional("membership-records", () =>
          this.resources.list("memberships"),
        ),
        optional("employees", () => this.resources.list("employees")),
        optional("technicians", () => this.resources.list("technicians")),
        optional("business-units", () => this.resources.list("business-units")),
        prisma.rawReportSnapshot.findFirst({
          where: {
            family: {
              in: [
                DashboardFamily.CALL_CENTER_BY_CSR,
                DashboardFamily.CALL_CENTER_SUMMARY,
              ],
            },
          },
          orderBy: { fetchedAt: "desc" },
        }),
      ]);
    if (!summaryRows && !salesRows && !recurringRows)
      throw new Error(
        "Membership sources unavailable; retaining previous snapshot",
      );
    const dashboard = buildMembershipPerformance({
      period,
      now: new Date().toISOString(),
      summaryRows,
      salesRows:
        employees && technicians && businessUnits && csr ? salesRows : null,
      recurringRows,
      memberships,
      membershipDetails,
      employees: employees ?? [],
      technicians: technicians ?? [],
      businessUnits: businessUnits ?? [],
      csrNames: buildCsrPerformanceDashboard(csr?.payloadJson ?? {}).rows.map(
        (row) => row.name,
      ),
      monthlyGoal: config.monthlyGoal,
      goalScope: config.goalScope,
    });
    await this.save(period, dashboard);
    logger.info("Membership dashboard refreshed", {
      ...period,
      state: dashboard.state,
      sources: dashboard.sources,
    });
    return {
      state: dashboard.state,
      snapshotTime: dashboard.snapshotTime,
      ...period,
    };
  }

  private async save(
    period: MembershipPeriod,
    dashboard: ReturnType<typeof buildMembershipPerformance>,
  ) {
    const values = {
      businessDateFrom: new Date(`${period.from}T00:00:00Z`),
      businessDateTo: new Date(`${period.to}T00:00:00Z`),
      payloadJson: dashboard as unknown as Prisma.InputJsonValue,
      snapshotTime: new Date(dashboard.snapshotTime!),
    };
    await prisma.dashboardReadModel.upsert({
      where: {
        family_scopeKey: {
          family: DashboardFamily.CALL_CENTER_SOURCE,
          scopeKey: membershipScopeKey(period),
        },
      },
      create: {
        family: DashboardFamily.CALL_CENTER_SOURCE,
        scopeKey: membershipScopeKey(period),
        sourceSnapshotIds: [],
        ...values,
      },
      update: values,
    });
  }
}
