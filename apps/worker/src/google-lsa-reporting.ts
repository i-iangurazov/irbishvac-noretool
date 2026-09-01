const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_LSA_ACCOUNT_REPORTS_URL =
  "https://localservices.googleapis.com/v1/accountReports:search";

type FetchLike = typeof fetch;

export type GoogleLsaReportingConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  managerCustomerId: string;
  customerId: string;
};

export type GoogleLsaSpendResult = {
  spend: number;
  currency: string;
  chargedLeads: number;
  phoneCalls: number;
  connectedPhoneCalls: number;
  accountCount: number;
  rowCount: number;
};

type GoogleTokenPayload = {
  access_token?: unknown;
  error?: unknown;
  error_description?: unknown;
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function numericValue(value: unknown, field: string) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Google LSA Reporting API returned invalid ${field}`);
  }
  return parsed;
}

function normalizedCustomerId(value: string) {
  return value.replace(/[^0-9]/g, "");
}

async function responsePayload(response: Response) {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

function apiError(service: string, status: number, payload: unknown) {
  const root = objectValue(payload);
  const nested = objectValue(root?.error);
  const code = nested?.status ?? nested?.code ?? root?.error;
  const description = nested?.message ?? root?.error_description;
  return [
    `${service} returned HTTP ${status}`,
    typeof code === "string" || typeof code === "number" ? String(code) : null,
    typeof description === "string" ? description : null,
  ].filter(Boolean).join(": ");
}

export function summarizeGoogleLsaAccountReports(
  payloads: unknown[],
  expectedCustomerId: string,
): GoogleLsaSpendResult {
  const expected = normalizedCustomerId(expectedCustomerId);
  let spend = 0;
  let chargedLeads = 0;
  let phoneCalls = 0;
  let connectedPhoneCalls = 0;
  let rowCount = 0;
  const accountIds = new Set<string>();
  const currencies = new Set<string>();

  for (const payload of payloads) {
    const root = objectValue(payload);
    const reports = Array.isArray(root?.accountReports) ? root.accountReports : [];
    for (const reportValue of reports) {
      const report = objectValue(reportValue);
      if (!report) continue;
      const accountId = normalizedCustomerId(String(report.accountId ?? ""));
      if (!accountId) {
        throw new Error("Google LSA Reporting API returned a row without accountId");
      }
      if (expected && accountId !== expected) {
        throw new Error(`Google LSA Reporting API returned unexpected account ${accountId}`);
      }
      const currency = String(report.currencyCode ?? "").toUpperCase();
      if (!currency) {
        throw new Error("Google LSA Reporting API returned a row without currencyCode");
      }
      currencies.add(currency);
      accountIds.add(accountId);
      spend += numericValue(report.currentPeriodTotalCost, "currentPeriodTotalCost");
      chargedLeads += numericValue(report.currentPeriodChargedLeads, "currentPeriodChargedLeads");
      phoneCalls += numericValue(report.currentPeriodPhoneCalls, "currentPeriodPhoneCalls");
      connectedPhoneCalls += numericValue(
        report.currentPeriodConnectedPhoneCalls,
        "currentPeriodConnectedPhoneCalls",
      );
      rowCount += 1;
    }
  }

  if (rowCount === 0) {
    throw new Error("Google LSA Reporting API returned no account reports for the configured customer");
  }
  if (currencies.size !== 1) {
    throw new Error("Google LSA Reporting API returned mixed currencies");
  }

  return {
    spend: Math.round(spend * 100) / 100,
    currency: [...currencies][0]!,
    chargedLeads,
    phoneCalls,
    connectedPhoneCalls,
    accountCount: accountIds.size,
    rowCount,
  };
}

export class GoogleLsaReportingClient {
  constructor(
    private readonly config: GoogleLsaReportingConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  isConfigured() {
    return Boolean(
      this.config.clientId &&
      this.config.clientSecret &&
      this.config.refreshToken &&
      normalizedCustomerId(this.config.managerCustomerId) &&
      normalizedCustomerId(this.config.customerId),
    );
  }

  private async getAccessToken() {
    const response = await this.fetchImpl(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await responsePayload(response) as GoogleTokenPayload | null;
    if (!response.ok) {
      throw new Error(apiError("Google OAuth token exchange", response.status, payload));
    }
    if (typeof payload?.access_token !== "string" || !payload.access_token) {
      throw new Error("Google OAuth token exchange returned no access token");
    }
    return payload.access_token;
  }

  async getMtdSpend(start: string, end: string): Promise<GoogleLsaSpendResult> {
    if (!this.isConfigured()) {
      throw new Error("Google LSA Reporting API is not configured");
    }

    const accessToken = await this.getAccessToken();
    const [startYear, startMonth, startDay] = start.split("-").map(Number);
    const [endYear, endMonth, endDay] = end.split("-").map(Number);
    const query = [
      `manager_customer_id:${normalizedCustomerId(this.config.managerCustomerId)}`,
      `customer_id:${normalizedCustomerId(this.config.customerId)}`,
    ].join(";");
    const payloads: unknown[] = [];
    let pageToken: string | null = null;

    do {
      const url = new URL(GOOGLE_LSA_ACCOUNT_REPORTS_URL);
      url.searchParams.set("query", query);
      url.searchParams.set("startDate.year", String(startYear));
      url.searchParams.set("startDate.month", String(startMonth));
      url.searchParams.set("startDate.day", String(startDay));
      url.searchParams.set("endDate.year", String(endYear));
      url.searchParams.set("endDate.month", String(endMonth));
      url.searchParams.set("endDate.day", String(endDay));
      url.searchParams.set("pageSize", "10000");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const response = await this.fetchImpl(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(20_000),
      });
      const payload = await responsePayload(response);
      if (!response.ok) {
        throw new Error(apiError("Google LSA Reporting API", response.status, payload));
      }
      payloads.push(payload);
      const nextPageToken = objectValue(payload)?.nextPageToken;
      pageToken = typeof nextPageToken === "string" && nextPageToken ? nextPageToken : null;
    } while (pageToken);

    return summarizeGoogleLsaAccountReports(payloads, this.config.customerId);
  }
}
