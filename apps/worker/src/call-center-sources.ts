import { getConfig } from "@irbis/config";
import { DashboardFamily, Prisma, prisma } from "@irbis/db";
import {
  buildCsrJobs,
  buildCsrMemberships,
  buildCsrTextLeads,
  csrDateKey,
  csrMonths,
  csrReportMonth,
  emptyCsrSupplement,
  type CsrSupplement,
} from "@irbis/domain";
import { GoogleSheetsClient, ServiceTitanClient } from "@irbis/integrations";
import { createLogger } from "@irbis/utils";

const logger = createLogger("worker-csr-sources");
const TTL = 10 * 60_000;
const inFlight = new Map<string, Promise<CsrSupplement>>();

/** Shared across the Summary and By CSR refreshes; only aggregates are persisted. */
export function refreshCsrSources(
  from: string,
  to: string,
  correlationId: string,
): Promise<CsrSupplement> {
  const key = `csr-sources:v1:${from}:${to}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = refresh(from, to, key, correlationId).finally(() =>
    inFlight.delete(key),
  );
  inFlight.set(key, promise);
  return promise;
}

async function refresh(
  from: string,
  to: string,
  key: string,
  correlationId: string,
): Promise<CsrSupplement> {
  const cached = await prisma.dashboardReadModel.findUnique({
    where: {
      family_scopeKey: {
        family: DashboardFamily.CALL_CENTER_BY_CSR,
        scopeKey: key,
      },
    },
  });
  if (cached?.snapshotTime && Date.now() - cached.snapshotTime.getTime() < TTL)
    return cached.payloadJson as unknown as CsrSupplement;
  const config = getConfig();
  const sheets = new GoogleSheetsClient();
  const st = new ServiceTitanClient();
  const now = new Date().toISOString();
  const result = emptyCsrSupplement(from, to);
  const report = (reportId: string, jobs = false) =>
    st.fetchPaginatedReport({
      family: "callCenterByCsr",
      category: "operations",
      reportId,
      correlationId,
      pageSize: 5000,
      retryRateLimits: true,
      parameters: [
        { name: "From", value: from },
        { name: "To", value: to },
        ...(jobs
          ? [
              { name: "DateType", value: 2 },
              { name: "IncludeAdjustmentInvoices", value: false },
            ]
          : []),
      ],
    });
  const reads = await Promise.allSettled([
    readCsrTextSources(sheets, from, to),
    report(config.csr.jobsReportId, true).then((response) =>
      buildCsrJobs(response.payload, now),
    ),
    report(config.csr.membershipsReportId).then((response) =>
      buildCsrMemberships(response.payload, from, to, now),
    ),
  ]);
  const [text, jobs, memberships] = reads;
  if (text.status === "fulfilled") result.text = text.value;
  if (jobs.status === "fulfilled") result.jobs = jobs.value;
  if (memberships.status === "fulfilled")
    result.memberships = memberships.value;
  reads.forEach((read, index) => {
    // Do not put report rows or customer details into logs.
    if (read.status === "rejected")
      logger.warn("CSR supplementary source unavailable", {
        source: ["text", "jobs", "memberships"][index],
        from,
        to,
        errorType: read.reason instanceof Error ? read.reason.name : "Error",
      });
  });
  const values = {
    businessDateFrom: new Date(`${from}T00:00:00Z`),
    businessDateTo: new Date(`${to}T00:00:00Z`),
    payloadJson: result as unknown as Prisma.InputJsonValue,
    snapshotTime: new Date(now),
  };
  await prisma.dashboardReadModel.upsert({
    where: {
      family_scopeKey: {
        family: DashboardFamily.CALL_CENTER_BY_CSR,
        scopeKey: key,
      },
    },
    create: {
      family: DashboardFamily.CALL_CENTER_BY_CSR,
      scopeKey: key,
      sourceSnapshotIds: [],
      ...values,
    },
    update: values,
  });
  return result;
}

export async function readCsrTextSources(
  client: GoogleSheetsClient,
  from: string,
  to: string,
) {
  const config = getConfig().campaignPerformance.google;
  if (!client.isConfigured()) return emptyCsrSupplement(from, to).text;
  const months = csrMonths(from, to);
  const discovered = new Map<string, string[]>();
  const folderId = getConfig().csr.reportsFolderId;
  if (folderId) {
    try {
      const files = await client.listFolderFiles(folderId);
      const visit = (items: typeof files, parentName = "") => {
        for (const file of items) {
          if (file.mimeType !== "application/vnd.google-apps.spreadsheet")
            continue;
          const month = csrReportMonth(file.name, parentName);
          if (month && months.includes(month))
            discovered.set(month, [...(discovered.get(month) ?? []), file.id]);
        }
      };
      visit(files);
      // Year subfolders only; stay inside the shared CSR Reports folder.
      for (const folder of files
        .filter(
          (file) =>
            file.mimeType === "application/vnd.google-apps.folder" &&
            /\b20\d{2}\b/.test(file.name),
        )
        .slice(0, 10)) {
        visit(await client.listFolderFiles(folder.id), folder.name);
      }
    } catch {
      logger.warn(
        "CSR folder discovery unavailable; using configured spreadsheet IDs",
      );
    }
  }
  const mapped = { ...config.spreadsheetIdsByMonth };
  for (const [month, ids] of discovered)
    if (!mapped[month] && ids.length === 1) mapped[month] = ids[0]!;
  const ids = [
    ...new Set(
      [...months.map((month) => mapped[month]), config.spreadsheetId].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ];
  const valid: Array<{ month: string; values: unknown[][] }> = [];
  for (const id of ids) {
    try {
      const metadata = await client.getSpreadsheetMetadata(id);
      const master = metadata.sheets?.find(
        (sheet) => sheet.properties.title === "Master Sheet",
      );
      const rowCount = master?.properties.gridProperties?.rowCount;
      if (!master || !rowCount || rowCount > 50_000) continue;
      const response = await client.getValues(
        `'Master Sheet'!C1:N${rowCount}`,
        id,
      );
      const values = response.values ?? [];
      for (const month of months) {
        const explicitlyMapped = mapped[month] === id;
        // The legacy default is August; prove its month from the dated rows rather than reuse it for missing YTD months.
        const hasDatedRows = values
          .slice(1)
          .some((row) => csrDateKey(row[1])?.startsWith(month));
        if (
          (explicitlyMapped || hasDatedRows) &&
          !valid.some((entry) => entry.month === month)
        )
          valid.push({ month, values });
      }
    } catch (error) {
      logger.warn("CSR spreadsheet unavailable", {
        errorType: error instanceof Error ? error.name : "Error",
      });
    }
  }
  return buildCsrTextLeads(valid, from, to, new Date().toISOString());
}
