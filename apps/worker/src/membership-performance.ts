import { getConfig } from "@irbis/config";
import { DashboardFamily, Prisma, prisma } from "@irbis/db";
import {
  buildCsrPerformanceDashboard,
  buildMembershipPerformance,
  buildMembershipCustomers,
  membershipCustomerScopeKey,
  type MembershipCustomerSnapshot,
  membershipComparisonPeriods,
  membershipScopeKey,
  membershipRecurringFetchPeriod,
  resolveMembershipPeriod,
  resolveTabularReport,
  buildMembershipLedger,
  validateMembershipSales,
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

/** Preserve one-to-one invoice evidence; deleted/current records can share all other sale fields. */
export function membershipSalesEvidence(
  base: Row[] | null,
  details: Row[] | null,
) {
  const signature = (row: Row) =>
    JSON.stringify([
      row.CustomerName,
      row.SoldBy,
      row.SoldOn,
      row.ActivationMethod,
      row.MembershipPrice,
      row.From,
      row.To,
      row.MembershipStatus,
    ]);
  const matching = Boolean(
    base &&
    details &&
    JSON.stringify(base.map(signature).sort()) ===
      JSON.stringify(details.map(signature).sort()),
  );
  const pool = new Map<string, Row[]>();
  for (const row of base ?? [])
    pool.set(signature(row), [...(pool.get(signature(row)) ?? []), row]);
  return {
    matching,
    rows: matching
      ? details!.map((row) => ({
          ...pool.get(signature(row))!.shift(),
          ...row,
        }))
      : base,
  };
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
    const salesParameters: ReportParameter[] = [
      ...range,
      { name: "Statuses", value: [0, 1, 2, 3, 4] },
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
      report("sold-by", config.salesReportId, salesParameters, [
        "SoldBy",
        "SoldOn",
        "ActivationMethod",
      ]),
    );
    const detailedSalesRows = await optional("sales-details", () =>
      report("other", config.salesDetailsReportId, salesParameters, [
        "CustomerMembershipId",
        "MembershipType",
        "SoldBy",
        "SoldOn",
        "ActivationMethod",
        "MembershipPrice",
      ]),
    );
    const evidence = membershipSalesEvidence(baseSalesRows, detailedSalesRows);
    const matching = evidence.matching;
    let salesRows = evidence.rows;
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
    const invoiceCache = new Map<string, Row>();
    const loadInvoices = async (numbers: string[]) => {
      const missing = [...new Set(numbers)].filter(
        (number) => !invoiceCache.has(number),
      );
      if (missing.some((number) => !number))
        throw new Error("Invoice number missing");
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(4, missing.length) }, async () => {
          while (next < missing.length) {
            const number = missing[next++]!;
            invoiceCache.set(number, await this.resources.invoice(number));
          }
        }),
      );
      return numbers.map((number) => invoiceCache.get(number)!);
    };
    const accountingInvoices = await optional("invoice-ledger", async () => {
      const rows = await this.resources.invoices(period);
      rows.forEach((row) => invoiceCache.set(String(row.referenceNumber), row));
      await loadInvoices([
        ...(salesRows ?? [])
          .filter((row) => row.MembershipStatus !== "Deleted")
          .map((row) => String(row.SaleRenewalInvoiceNumber ?? "")),
        ...(grossJobRevenueRows ?? []).map((row) =>
          String(row.InvoiceNumber ?? ""),
        ),
      ]);
      return [...invoiceCache.values()];
    });
    const salesValidation =
      salesRows && accountingInvoices
        ? await optional("sale-invoice-validation", async () =>
            validateMembershipSales(salesRows!, accountingInvoices),
          )
        : null;
    salesRows = salesValidation?.accepted ?? null;
    const unpaidLedger =
      accountingInvoices && grossJobRevenueRows && salesRows
        ? await optional("invoice-ledger-build", async () =>
            buildMembershipLedger({
              period,
              invoices: accountingInvoices,
              payments: null,
              jobRows: grossJobRevenueRows,
              salesRows: salesRows!,
            }),
          )
        : null;
    const paymentRows = unpaidLedger
      ? await optional("invoice-payments", () =>
          this.resources.invoicePayments(
            unpaidLedger.invoices.map((row) => row.id),
          ),
        )
      : null;
    const ledger =
      unpaidLedger &&
      accountingInvoices &&
      grossJobRevenueRows &&
      salesRows &&
      paymentRows
        ? await optional("payment-ledger-build", async () =>
            buildMembershipLedger({
              period,
              invoices: accountingInvoices,
              payments: paymentRows,
              jobRows: grossJobRevenueRows,
              salesRows: salesRows!,
            }),
          )
        : unpaidLedger;
    const jobRevenueRows =
      unpaidLedger && grossJobRevenueRows
        ? await optional("member-invoice-items", async () => {
            const completed = new Set(
              grossJobRevenueRows.map((row) => String(row.JobNumber)),
            );
            if (
              grossJobRevenueRows.some(
                (row) =>
                  !unpaidLedger.invoices.some(
                    (invoice) => invoice.number === String(row.InvoiceNumber),
                  ),
              )
            )
              throw new Error("Completed job invoice missing");
            return unpaidLedger.invoices
              .filter(
                (invoice) =>
                  invoice.jobNumber && completed.has(invoice.jobNumber),
              )
              .map((invoice) => ({
                JobNumber: invoice.jobNumber,
                InvoiceNumber: invoice.number,
                TotalRevenue: invoice.jobRevenue,
                MembershipCharges: 0,
              }));
          })
        : null;
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
    // Month-over-month, quarter-over-quarter and year-over-year context. Each
    // comparison period is optional so one slow report cannot fail the board.
    const comparisonRequests = new Map<
      string,
      Promise<{ summaryRows: Row[] | null; salesRows: Row[] | null }>
    >();
    const comparisonRows = await Promise.all(
      membershipComparisonPeriods(period).map(
        async ({ kind, period: comparisonPeriod }) => {
          const key = `${comparisonPeriod.from}:${comparisonPeriod.to}`;
          let request = comparisonRequests.get(key);
          if (!request) {
            request = (async () => {
              const comparisonRange: ReportParameter[] = [
                { name: "From", value: comparisonPeriod.from },
                { name: "To", value: comparisonPeriod.to },
              ];
              const summary = await optional(`comparison-${kind}-summary`, () =>
                report(
                  "other",
                  config.summaryReportId,
                  [
                    ...comparisonRange,
                    { name: "IncludeInactiveMembershipTypes", value: true },
                  ],
                  [
                    "Name",
                    "ActiveAtStart",
                    "ActiveAtEnd",
                    "Canceled",
                    "Expired",
                  ],
                ),
              );
              const sales = await optional(`comparison-${kind}-sales`, () =>
                report(
                  "sold-by",
                  config.salesReportId,
                  [
                    ...comparisonRange,
                    { name: "Statuses", value: [0, 1, 2, 3, 4] },
                  ],
                  ["SoldBy", "SoldOn", "ActivationMethod"],
                ),
              );
              const validated = sales
                ? await optional(
                    `comparison-${kind}-validated-sales`,
                    async () =>
                      validateMembershipSales(
                        sales,
                        await loadInvoices(
                          sales
                            .filter((row) => row.MembershipStatus !== "Deleted")
                            .map((row) =>
                              String(row.SaleRenewalInvoiceNumber ?? ""),
                            ),
                        ),
                      ),
                  )
                : null;
              return {
                summaryRows: summary,
                salesRows: validated?.accepted ?? null,
              };
            })();
            comparisonRequests.set(key, request);
          }
          return { kind, period: comparisonPeriod, ...(await request) };
        },
      ),
    );
    const dashboard = buildMembershipPerformance({
      period,
      now: new Date().toISOString(),
      comparisonRows,
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
      hiddenRepresentativeIds: config.hiddenRepresentativeIds,
      goalScope: config.goalScope,
      ledger,
    });
    const customers = buildMembershipCustomers({
      dashboard,
      summaryRows,
      salesRows: matching ? salesRows : null,
      membershipRecords: memberships,
      membershipDetails,
      statusHistory: history,
    });
    dashboard.salesAudit = { excluded: salesValidation?.excluded ?? [] };
    await this.save(period, dashboard, customers);
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
    customers: MembershipCustomerSnapshot,
  ) {
    const values = {
      businessDateFrom: new Date(`${period.from}T00:00:00Z`),
      businessDateTo: new Date(`${period.to}T00:00:00Z`),
      payloadJson: dashboard as unknown as Prisma.InputJsonValue,
      snapshotTime: new Date(dashboard.snapshotTime!),
    };
    await prisma.$transaction([
      prisma.dashboardReadModel.upsert({
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
      }),
      prisma.dashboardReadModel.upsert({
        where: {
          family_scopeKey: {
            family: DashboardFamily.CALL_CENTER_SOURCE,
            scopeKey: membershipCustomerScopeKey(period),
          },
        },
        create: {
          family: DashboardFamily.CALL_CENTER_SOURCE,
          scopeKey: membershipCustomerScopeKey(period),
          sourceSnapshotIds: [],
          ...values,
          payloadJson: customers as unknown as Prisma.InputJsonValue,
        },
        update: {
          ...values,
          payloadJson: customers as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
  }
}
