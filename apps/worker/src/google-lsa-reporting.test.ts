import { describe, expect, it, vi } from "vitest";
import {
  GoogleLsaReportingClient,
  summarizeGoogleLsaAccountReports,
} from "./google-lsa-reporting";

const config = {
  clientId: "client-id",
  clientSecret: "client-secret",
  refreshToken: "refresh-token",
  managerCustomerId: "727-578-7919",
  customerId: "857-177-6056",
};

describe("summarizeGoogleLsaAccountReports", () => {
  it("sums date-bounded spend and lead metrics for the configured account", () => {
    expect(summarizeGoogleLsaAccountReports([
      {
        accountReports: [
          {
            accountId: "8571776056",
            currentPeriodTotalCost: "123.45",
            currentPeriodChargedLeads: "8",
            currentPeriodPhoneCalls: "11",
            currentPeriodConnectedPhoneCalls: "7",
            currencyCode: "USD",
          },
        ],
      },
    ], "857-177-6056")).toEqual({
      spend: 123.45,
      currency: "USD",
      chargedLeads: 8,
      phoneCalls: 11,
      connectedPhoneCalls: 7,
      accountCount: 1,
      rowCount: 1,
    });
  });

  it("rejects data for a different linked customer", () => {
    expect(() => summarizeGoogleLsaAccountReports([
      {
        accountReports: [{
          accountId: "2538010137",
          currentPeriodTotalCost: 50,
          currencyCode: "USD",
        }],
      },
    ], "8571776056")).toThrow("unexpected account 2538010137");
  });
});

describe("GoogleLsaReportingClient", () => {
  it("refreshes OAuth and requests the exact MTD account report", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token" }), {
        status: 200,
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        accountReports: [{
          accountId: "8571776056",
          currentPeriodTotalCost: 341.27,
          currentPeriodChargedLeads: 13,
          currentPeriodPhoneCalls: 15,
          currentPeriodConnectedPhoneCalls: 9,
          currencyCode: "USD",
        }],
      }), { status: 200 }));
    const client = new GoogleLsaReportingClient(config, fetchMock);

    await expect(client.getMtdSpend("2026-09-01", "2026-09-18")).resolves.toMatchObject({
      spend: 341.27,
      currency: "USD",
      chargedLeads: 13,
    });

    const tokenRequest = fetchMock.mock.calls[0];
    expect(tokenRequest?.[0]).toBe("https://oauth2.googleapis.com/token");
    expect(tokenRequest?.[1]).toMatchObject({ method: "POST" });
    expect(String(tokenRequest?.[1]?.body)).toContain("grant_type=refresh_token");

    const reportUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(reportUrl.origin + reportUrl.pathname).toBe(
      "https://localservices.googleapis.com/v1/accountReports:search",
    );
    expect(reportUrl.searchParams.get("query")).toBe(
      "manager_customer_id:7275787919;customer_id:8571776056",
    );
    expect(reportUrl.searchParams.get("startDate.year")).toBe("2026");
    expect(reportUrl.searchParams.get("startDate.month")).toBe("9");
    expect(reportUrl.searchParams.get("startDate.day")).toBe("1");
    expect(reportUrl.searchParams.get("endDate.day")).toBe("18");
  });

  it("surfaces permission failures without exposing OAuth credentials", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token" }), {
        status: 200,
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: {
          code: 403,
          status: "PERMISSION_DENIED",
          message: "You do not have access to customer id 8571776056",
        },
      }), { status: 403 }));
    const client = new GoogleLsaReportingClient(config, fetchMock);

    const error = await client.getMtdSpend("2026-09-01", "2026-09-18").catch((value) => value);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("PERMISSION_DENIED");
    expect(error.message).not.toContain(config.clientSecret);
    expect(error.message).not.toContain(config.refreshToken);
  });
});
