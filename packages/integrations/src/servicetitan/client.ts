import { getConfig } from "@irbis/config";
import { createLogger } from "@irbis/utils";
import { z } from "zod";
import type { ReportFamilyKey, ReportParameter } from "./reports";

const tokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional()
});

type AccessTokenCache = {
  accessToken: string;
  expiresAt: number;
};

type FetchReportOptions = {
  family: ReportFamilyKey;
  category: string;
  reportId: string;
  parameters: ReportParameter[];
  correlationId: string;
};

function parseRetryAfterSeconds(response: Response, body: string) {
  const retryAfterHeader = response.headers.get("retry-after");
  if (retryAfterHeader) {
    const retryAfterSeconds = Number(retryAfterHeader);
    if (Number.isFinite(retryAfterSeconds)) {
      return retryAfterSeconds;
    }

    const retryAt = Date.parse(retryAfterHeader);
    if (!Number.isNaN(retryAt)) {
      return Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000));
    }
  }

  const retryMatch = body.match(/try again in (\d+) seconds/i);
  if (retryMatch) {
    return Number(retryMatch[1]);
  }

  return null;
}

export class ServiceTitanRateLimitError extends Error {
  readonly family: ReportFamilyKey;
  readonly retryAfterSeconds: number | null;
  readonly body: string;

  constructor(options: {
    family: ReportFamilyKey;
    body: string;
    retryAfterSeconds: number | null;
  }) {
    const retrySuffix =
      options.retryAfterSeconds === null ? "" : ` Retry after ${options.retryAfterSeconds}s.`;

    super(`ServiceTitan rate limited report fetch for ${options.family}.${retrySuffix}`);
    this.name = "ServiceTitanRateLimitError";
    this.family = options.family;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.body = options.body;
  }
}

export class ServiceTitanClient {
  private tokenCache: AccessTokenCache | null = null;

  private readonly logger = createLogger("servicetitan-client");

  private readonly config = getConfig();

  getMissingConfiguration(): string[] {
    const requiredEntries = [
      ["SERVICETITAN_CLIENT_ID", this.config.serviceTitan.clientId],
      ["SERVICETITAN_CLIENT_SECRET", this.config.serviceTitan.clientSecret],
      ["SERVICETITAN_APP_KEY", this.config.serviceTitan.appKey],
      ["SERVICETITAN_TENANT_ID", this.config.serviceTitan.tenantId]
    ] as const;

    return requiredEntries
      .filter(([, value]) => value.trim().length === 0)
      .map(([name]) => name);
  }

  isConfigured(): boolean {
    return this.getMissingConfiguration().length === 0;
  }

  private assertConfigured() {
    const missing = this.getMissingConfiguration();
    if (missing.length === 0) {
      return;
    }

    throw new Error(
      `ServiceTitan client is not configured. Missing values: ${missing.join(", ")}`,
    );
  }

  async getAccessToken(): Promise<string> {
    this.assertConfigured();

    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 10_000) {
      return this.tokenCache.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.serviceTitan.clientId,
      client_secret: this.config.serviceTitan.clientSecret
    });

    const response = await fetch("https://auth.servicetitan.io/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      throw new Error(`Failed to retrieve ServiceTitan token: ${response.status}`);
    }

    const token = tokenSchema.parse(await response.json());
    this.tokenCache = {
      accessToken: token.access_token,
      expiresAt: Date.now() + (token.expires_in ?? 3_000) * 1_000
    };

    return token.access_token;
  }

  async fetchReport(options: FetchReportOptions) {
    this.assertConfigured();

    const accessToken = await this.getAccessToken();
    const endpoint = `https://api.servicetitan.io/reporting/v2/tenant/${this.config.serviceTitan.tenantId}/report-category/${options.category}/reports/${options.reportId}/data`;

    this.logger.info("Fetching ServiceTitan report", {
      correlationId: options.correlationId,
      family: options.family,
      category: options.category,
      reportId: options.reportId
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ST-App-Key": this.config.serviceTitan.appKey,
        Authorization: `Bearer ${accessToken}`,
        "X-Correlation-Id": options.correlationId
      },
      body: JSON.stringify({
        parameters: options.parameters
      })
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 429) {
        throw new ServiceTitanRateLimitError({
          family: options.family,
          body,
          retryAfterSeconds: parseRetryAfterSeconds(response, body)
        });
      }

      throw new Error(
        `ServiceTitan report fetch failed (${response.status}) ${options.family}: ${body}`,
      );
    }

    return {
      endpoint,
      payload: await response.json()
    };
  }
}
