import { getConfig } from "@irbis/config";
import { DashboardFamily, Prisma, prisma } from "@irbis/db";
import {
  buildCsrPerformanceDashboard,
  buildMembershipPerformance,
  membershipScopeKey,
  membershipRecurringFetchPeriod,
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
    const recurringPeriod = membershipRecurringFetchPeriod(period);
    const recurringRange: ReportParameter[] = [
      { name: "From", value: recurringPeriod.from },
      { name: "To", value: recurringPeriod.to },
      { name: "FilterBy", value: 0 },
    ];
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
        ["Name", "ActiveAtStart", "ActiveAtEnd", "Canceled", "Expired"],
      ),
    );
    const baseSalesRows = await optional("sales", () =>
      report("sold-by", config.salesReportId, range, [
        "SoldBy",
        "SoldOn",
        "ActivationMethod",
      ]),
    );
    const detailedSalesRows = await optional("sales-details", () =>
      report("other", config.salesDetailsReportId, range, [
        "CustomerMembershipId",
        "MembershipType",
        "SoldBy",
        "SoldOn",
        "ActivationMethod",
        "MembershipPrice",
      ]),
    );
    // Enrich only when both reports describe exactly the same sales cohort.
    const signature = (row: Row) =>
      JSON.stringify([
        row.CustomerName,
        row.SoldBy,
        row.SoldOn,
        row.ActivationMethod,
        row.MembershipPrice,
        row.From,
        row.To,
      ]);
    const matching =
      baseSalesRows &&
      detailedSalesRows &&
      JSON.stringify(baseSalesRows.map(signature).sort()) ===
        JSON.stringify(detailedSalesRows.map(signature).sort());
    const salesRows = matching ? detailedSalesRows : baseSalesRows;
    const grossJobRevenueRows = await optional("member-job-revenue", () =>
      report(
        "other",
        config.jobRevenueReportId,
        [
          ...range,
          { name: "DateType", value: 1 },
          { name: "IncludeAdjustmentInvoices", value: true },
        ],
        ["JobNumber", "InvoiceNumber", "TotalRevenue"],
      ),
    );
    const jobRevenueRows =
      grossJobRevenueRows &&
      (await optional("member-invoice-items", async () => {
        const numbers = [
          ...new Set(
            grossJobRevenueRows.map((row) => String(row.InvoiceNumber ?? "")),
          ),
        ];
        if (numbers.some((number) => !number))
          throw new Error("Invoice number missing");
        const deductions = new Map<string, number>();
        let next = 0;
        // Bounded concurrency keeps large YTD requests within the accounting API limit.
        await Promise.all(
          Array.from({ length: Math.min(4, numbers.length) }, async () => {
            while (next < numbers.length) {
              const number = numbers[next++]!;
              deductions.set(
                number,
                await this.resources.invoiceMembershipCharges(number),
              );
            }
          }),
        );
        return grossJobRevenueRows.map((row) => ({
          ...row,
          MembershipCharges: deductions.get(String(row.InvoiceNumber)),
        }));
      }));
    const recurringRows = await optional("recurring", () =>
      report("operations", config.recurringReportId, recurringRange, [
        "RecurringServiceEventId",
        "RecurringEventDate",
        "RecurringServiceName",
        "Status",
      ]),
    );
    const recurringDetails = await optional("recurring-details", () =>
      report("operations", config.recurringDetailsReportId, recurringRange, [
        "RecurringServiceEventId",
        "CustomerId",
        "CustomerName",
        "RecurringServiceMemo",
      ]),
    );
    const membershipDetails = await optional("renewal-dates", () =>
      report(
        "operations",
        config.detailsReportId,
        [{ name: "Statuses", value: [0, 1, 2, 3, 4] }],
        ["CustomerMembershipId", "SoldOn", "CustomerName", "MembershipType"],
      ),
    );
    const [memberships, employees, technicians, businessUnits, csr, history] =
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
        optional("status-history", () => this.resources.statusHistory()),
      ]);
    const marketSalesRows =
      salesRows && memberships && matching
        ? await optional("customer-types", async () => {
            const records = new Map(
              memberships.map((row) => [String(row.id), row]),
            );
            const ids = salesRows.map((row) =>
              String(
                records.get(String(row.CustomerMembershipId))?.customerId ?? "",
              ),
            );
            const types = await this.resources.customerTypes(ids);
            return salesRows.map((row, index) => ({
              ...row,
              CustomerType: types.get(ids[index]!),
            }));
          })
        : null;
    if (!summaryRows && !salesRows && !recurringRows)
      throw new Error(
        "Membership sources unavailable; retaining previous snapshot",
      );
    const dashboard = buildMembershipPerformance({
      period,
      now: new Date().toISOString(),
      summaryRows,
      salesRows:
        employees && technicians && businessUnits && csr
          ? (marketSalesRows ?? salesRows)
          : null,
      recurringRows,
      recurringDetails,
      history,
      jobRevenueRows,
      renewalTarget: config.renewalTarget ?? null,
      cancellationLimit: config.cancellationLimit ?? null,
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
