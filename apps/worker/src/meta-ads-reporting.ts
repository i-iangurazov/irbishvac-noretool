type FetchLike = typeof fetch;

export type MetaAdsReportingConfig = {
  accessToken: string;
  accountIds: string[];
  apiVersion: string;
};

export type MetaAdsAccountSpend = {
  accountId: string;
  accountName: string;
  spend: number;
  impressions: number;
  clicks: number;
};

export type MetaAdsSpendResult = {
  spend: number;
  currency: string;
  impressions: number;
  clicks: number;
  accountCount: number;
  rowCount: number;
  accounts: MetaAdsAccountSpend[];
};

type MetaAccount = {
  id: string;
  name: string;
  currency: string;
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizedAccountId(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? `act_${digits}` : "";
}

function numericValue(value: unknown, field: string) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Meta Ads Insights returned invalid ${field}`);
  }
  return parsed;
}

function integerValue(value: unknown, field: string) {
  const parsed = numericValue(value, field);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Meta Ads Insights returned non-integer ${field}`);
  }
  return parsed;
}

async function responsePayload(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function apiError(status: number, payload: unknown) {
  const error = objectValue(objectValue(payload)?.error);
  return [
    `Meta Graph API returned HTTP ${status}`,
    typeof error?.code === "number" || typeof error?.code === "string"
      ? String(error.code)
      : null,
    typeof error?.type === "string" ? error.type : null,
    typeof error?.message === "string" ? error.message : null,
  ]
    .filter(Boolean)
    .join(": ");
}

export function parseMetaAccount(
  payload: unknown,
  expectedAccountId: string,
): MetaAccount {
  const account = objectValue(payload);
  const accountId = normalizedAccountId(String(account?.id ?? ""));
  if (!accountId || accountId !== normalizedAccountId(expectedAccountId)) {
    throw new Error("Meta Graph API returned an unexpected ad account");
  }
  const accountName = String(account?.name ?? "").trim();
  const currency = String(account?.currency ?? "")
    .trim()
    .toUpperCase();
  if (!accountName) {
    throw new Error(`Meta Graph API returned no name for ${accountId}`);
  }
  if (!currency) {
    throw new Error(`Meta Graph API returned no currency for ${accountId}`);
  }
  return { id: accountId, name: accountName, currency };
}

export function summarizeMetaInsights(
  payload: unknown,
  account: MetaAccount,
  start: string,
  end: string,
): MetaAdsAccountSpend & { rowCount: number; currency: string } {
  const root = objectValue(payload);
  const rows = Array.isArray(root?.data) ? root.data : [];
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let rowCount = 0;

  for (const rowValue of rows) {
    const row = objectValue(rowValue);
    if (!row) continue;
    const accountId = normalizedAccountId(String(row.account_id ?? ""));
    if (!accountId || accountId !== account.id) {
      throw new Error("Meta Ads Insights returned an unexpected ad account");
    }
    if (
      String(row.date_start ?? "") !== start ||
      String(row.date_stop ?? "") !== end
    ) {
      throw new Error(
        "Meta Ads Insights returned an unexpected reporting period",
      );
    }
    spend += numericValue(row.spend, "spend");
    impressions += integerValue(row.impressions, "impressions");
    clicks += integerValue(row.clicks, "clicks");
    rowCount += 1;
  }

  return {
    accountId: account.id,
    accountName: account.name,
    spend: Math.round(spend * 100) / 100,
    impressions,
    clicks,
    currency: account.currency,
    rowCount,
  };
}

export class MetaAdsReportingClient {
  constructor(
    private readonly config: MetaAdsReportingConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private get accountIds() {
    return [
      ...new Set(
        this.config.accountIds.map(normalizedAccountId).filter(Boolean),
      ),
    ];
  }

  isConfigured() {
    return Boolean(
      this.config.accessToken &&
      this.accountIds.length > 0 &&
      /^v\d+\.\d+$/.test(this.config.apiVersion),
    );
  }

  private async request(path: string, searchParams: Record<string, string>) {
    const url = new URL(
      `https://graph.facebook.com/${this.config.apiVersion}/${path}`,
    );
    for (const [name, value] of Object.entries(searchParams)) {
      url.searchParams.set(name, value);
    }
    const response = await this.fetchImpl(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.config.accessToken}`,
      },
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await responsePayload(response);
    if (!response.ok) {
      throw new Error(apiError(response.status, payload));
    }
    return payload;
  }

  async getMtdSpend(start: string, end: string): Promise<MetaAdsSpendResult> {
    if (!this.isConfigured()) {
      throw new Error("Meta Ads Insights is not configured");
    }

    const accounts = await Promise.all(
      this.accountIds.map(async (accountId) => {
        const [accountPayload, insightPayload] = await Promise.all([
          this.request(accountId, { fields: "id,name,currency" }),
          this.request(`${accountId}/insights`, {
            fields: "account_id,spend,impressions,clicks",
            level: "account",
            time_range: JSON.stringify({ since: start, until: end }),
          }),
        ]);
        const account = parseMetaAccount(accountPayload, accountId);
        return summarizeMetaInsights(insightPayload, account, start, end);
      }),
    );

    const currencies = new Set(accounts.map((account) => account.currency));
    if (currencies.size !== 1) {
      throw new Error("Meta Ads Insights returned mixed account currencies");
    }

    return {
      spend:
        Math.round(
          accounts.reduce((sum, account) => sum + account.spend, 0) * 100,
        ) / 100,
      currency: accounts[0]!.currency,
      impressions: accounts.reduce(
        (sum, account) => sum + account.impressions,
        0,
      ),
      clicks: accounts.reduce((sum, account) => sum + account.clicks, 0),
      accountCount: accounts.length,
      rowCount: accounts.reduce((sum, account) => sum + account.rowCount, 0),
      accounts: accounts.map((account) => ({
        accountId: account.accountId,
        accountName: account.accountName,
        spend: account.spend,
        impressions: account.impressions,
        clicks: account.clicks,
      })),
    };
  }
}
