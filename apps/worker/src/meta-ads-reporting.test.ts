import { describe, expect, it, vi } from "vitest";
import {
  MetaAdsReportingClient,
  parseMetaAccount,
  summarizeMetaInsights,
} from "./meta-ads-reporting";

const config = {
  accessToken: "test-token",
  accountIds: ["act_101", "202"],
  apiVersion: "v23.0",
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Meta Ads reporting parsing", () => {
  it("validates the account and reporting period", () => {
    const account = parseMetaAccount(
      { id: "act_101", name: "IRBIS HVAC", currency: "usd" },
      "101",
    );
    expect(
      summarizeMetaInsights(
        {
          data: [
            {
              account_id: "101",
              spend: "123.45",
              impressions: "1000",
              clicks: "25",
              date_start: "2026-08-01",
              date_stop: "2026-08-31",
            },
          ],
        },
        account,
        "2026-08-01",
        "2026-08-31",
      ),
    ).toEqual({
      accountId: "act_101",
      accountName: "IRBIS HVAC",
      currency: "USD",
      spend: 123.45,
      impressions: 1000,
      clicks: 25,
      rowCount: 1,
    });
  });

  it("returns a verified zero when an account has no delivery", () => {
    const account = parseMetaAccount(
      { id: "act_101", name: "IRBIS HVAC", currency: "USD" },
      "act_101",
    );
    expect(
      summarizeMetaInsights({ data: [] }, account, "2026-09-01", "2026-09-01"),
    ).toMatchObject({ spend: 0, impressions: 0, clicks: 0, rowCount: 0 });
  });
});

describe("MetaAdsReportingClient", () => {
  it("loads and aggregates all configured ad accounts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ id: "act_101", name: "HVAC", currency: "USD" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              account_id: "101",
              spend: "10.11",
              impressions: "100",
              clicks: "5",
              date_start: "2026-08-01",
              date_stop: "2026-08-31",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: "act_202", name: "Plumbing", currency: "USD" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              account_id: "202",
              spend: "20.22",
              impressions: "200",
              clicks: "7",
              date_start: "2026-08-01",
              date_stop: "2026-08-31",
            },
          ],
        }),
      );
    const client = new MetaAdsReportingClient(config, fetchMock);

    await expect(
      client.getMtdSpend("2026-08-01", "2026-08-31"),
    ).resolves.toEqual({
      spend: 30.33,
      currency: "USD",
      impressions: 300,
      clicks: 12,
      accountCount: 2,
      rowCount: 2,
      accounts: [
        {
          accountId: "act_101",
          accountName: "HVAC",
          spend: 10.11,
          impressions: 100,
          clicks: 5,
        },
        {
          accountId: "act_202",
          accountName: "Plumbing",
          spend: 20.22,
          impressions: 200,
          clicks: 7,
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers.Authorization).toBe("Bearer test-token");
    }
  });

  it("reports a redacted provider error", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse(
          {
            error: {
              code: 190,
              type: "OAuthException",
              message: "Invalid OAuth access token.",
            },
          },
          401,
        ),
      ),
    );
    const client = new MetaAdsReportingClient(config, fetchMock);

    await expect(
      client.getMtdSpend("2026-08-01", "2026-08-31"),
    ).rejects.toThrow(
      "Meta Graph API returned HTTP 401: 190: OAuthException: Invalid OAuth access token.",
    );
  });

  it("rejects mixed account currencies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ id: "act_101", name: "HVAC", currency: "USD" }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ id: "act_202", name: "Plumbing", currency: "CAD" }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: [] }));
    const client = new MetaAdsReportingClient(config, fetchMock);

    await expect(
      client.getMtdSpend("2026-08-01", "2026-08-31"),
    ).rejects.toThrow("Meta Ads Insights returned mixed account currencies");
  });
});
