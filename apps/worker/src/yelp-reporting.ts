const YELP_DAILY_REPORT_URL = "https://api.yelp.com/v3/reporting/businesses/daily";

type FetchLike = typeof fetch;

export type YelpReportingConfig = {
  apiKey: string;
  businessIds: string[];
};

export type YelpSpendResult = {
  spend: number;
  businessCount: number;
  dailyRowCount: number;
  programRowCount: number;
  reportId: string;
};

type YelpErrorPayload = {
  error?: {
    code?: unknown;
    description?: unknown;
  };
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function errorMessage(status: number, payload: unknown) {
  const parsed = objectValue(payload) as YelpErrorPayload | null;
  const code = typeof parsed?.error?.code === "string" ? parsed.error.code : null;
  const description = typeof parsed?.error?.description === "string"
    ? parsed.error.description
    : null;
  return [
    `Yelp Reporting API returned HTTP ${status}`,
    code,
    description
  ].filter(Boolean).join(": ");
}

async function responsePayload(response: Response) {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

export function summarizeYelpDailyReport(payload: unknown): Omit<YelpSpendResult, "reportId"> {
  const root = objectValue(payload);
  const businesses = Array.isArray(root?.data) ? root.data : [];
  let totalCents = 0;
  let dailyRowCount = 0;
  let programRowCount = 0;

  for (const businessValue of businesses) {
    const business = objectValue(businessValue);
    const metrics = Array.isArray(business?.metrics) ? business.metrics : [];
    for (const metricValue of metrics) {
      const metric = objectValue(metricValue);
      dailyRowCount += 1;
      const programs = Array.isArray(metric?.programs) ? metric.programs : [];
      for (const programValue of programs) {
        const program = objectValue(programValue);
        const adCost = objectValue(program?.ad_cost);
        const cost = Number(adCost?.cost ?? 0);
        const currency = String(adCost?.currency ?? "USD").toUpperCase();
        if (!Number.isFinite(cost) || cost < 0) {
          throw new Error("Yelp Reporting API returned an invalid ad_cost");
        }
        if (cost > 0 && currency !== "USD") {
          throw new Error(`Yelp Reporting API returned unsupported ad_cost currency ${currency}`);
        }
        totalCents += cost;
        programRowCount += 1;
      }
    }
  }

  return {
    spend: Math.round(totalCents) / 100,
    businessCount: businesses.length,
    dailyRowCount,
    programRowCount
  };
}

export class YelpReportingClient {
  constructor(
    private readonly config: YelpReportingConfig,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    private readonly pollAttempts = 40,
    private readonly pollIntervalMs = 3_000,
  ) {}

  isConfigured() {
    return Boolean(this.config.apiKey && this.config.businessIds.length > 0);
  }

  async getMtdAdSpend(start: string, end: string): Promise<YelpSpendResult> {
    if (!this.isConfigured()) {
      throw new Error("Yelp Reporting API is not configured");
    }

    const createResponse = await this.fetchImpl(YELP_DAILY_REPORT_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        start,
        end,
        ids: this.config.businessIds,
        metrics: ["ad_cost"]
      }),
      signal: AbortSignal.timeout(15_000)
    });
    const createPayload = await responsePayload(createResponse);
    if (createResponse.status !== 202) {
      throw new Error(errorMessage(createResponse.status, createPayload));
    }
    const reportId = objectValue(createPayload)?.id;
    if (typeof reportId !== "string" || !reportId) {
      throw new Error("Yelp Reporting API did not return a report ID");
    }

    for (let attempt = 1; attempt <= this.pollAttempts; attempt += 1) {
      const reportResponse = await this.fetchImpl(
        `${YELP_DAILY_REPORT_URL}/${encodeURIComponent(reportId)}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.config.apiKey}`
          },
          signal: AbortSignal.timeout(15_000)
        },
      );
      const reportPayload = await responsePayload(reportResponse);
      if (reportResponse.status === 200) {
        return { ...summarizeYelpDailyReport(reportPayload), reportId };
      }
      if (reportResponse.status !== 202) {
        throw new Error(errorMessage(reportResponse.status, reportPayload));
      }
      const code = (objectValue(reportPayload) as YelpErrorPayload | null)?.error?.code;
      if (code === "JOB_FAILED") {
        throw new Error(errorMessage(reportResponse.status, reportPayload));
      }
      if (attempt < this.pollAttempts) {
        await this.sleep(this.pollIntervalMs);
      }
    }

    throw new Error(`Yelp Reporting API report ${reportId} was not ready after ${this.pollAttempts} checks`);
  }
}
