import { describe, expect, it, vi } from "vitest";
import { summarizeYelpDailyReport, YelpReportingClient } from "./yelp-reporting";

describe("summarizeYelpDailyReport", () => {
  it("sums program ad costs in cents across businesses and days", () => {
    expect(summarizeYelpDailyReport({
      data: [
        {
          metrics: [
            { date: "2026-08-01", programs: [{ ad_cost: { currency: "USD", cost: 571 } }] },
            { date: "2026-08-02", programs: [
              { ad_cost: { currency: "USD", cost: 591 } },
              { ad_cost: { currency: "None", cost: 0 } }
            ] }
          ]
        },
        {
          metrics: [
            { date: "2026-08-01", programs: [{ ad_cost: { currency: "USD", cost: 1_253 } }] }
          ]
        }
      ]
    })).toEqual({
      spend: 24.15,
      businessCount: 2,
      dailyRowCount: 3,
      programRowCount: 4
    });
  });

  it("rejects a non-USD positive cost", () => {
    expect(() => summarizeYelpDailyReport({
      data: [{ metrics: [{ programs: [{ ad_cost: { currency: "CAD", cost: 100 } }] }] }]
    })).toThrow("unsupported ad_cost currency CAD");
  });
});

describe("YelpReportingClient", () => {
  it("creates, polls and returns a completed daily report", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "report-1" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "JOB_NOT_COMPLETE" } }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ metrics: [{ programs: [{ ad_cost: { currency: "USD", cost: 12_345 } }] }] }]
      }), { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new YelpReportingClient(
      { apiKey: "secret", businessIds: ["business-1"] },
      fetchMock,
      sleep,
      3,
      1,
    );

    await expect(client.getMtdAdSpend("2026-08-01", "2026-08-18")).resolves.toMatchObject({
      spend: 123.45,
      reportId: "report-1"
    });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(1, YELP_DAILY_REPORT_URL_FOR_TEST, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        start: "2026-08-01",
        end: "2026-08-18",
        ids: ["business-1"],
        metrics: ["ad_cost"]
      })
    }));
  });

  it("surfaces an entitlement error without exposing the key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "PARTNER_ENDPOINT_DISABLED", description: "Endpoint disabled" }
    }), { status: 403 }));
    const client = new YelpReportingClient(
      { apiKey: "secret", businessIds: ["business-1"] },
      fetchMock,
    );

    await expect(client.getMtdAdSpend("2026-08-01", "2026-08-18")).rejects.toThrow(
      "Yelp Reporting API returned HTTP 403: PARTNER_ENDPOINT_DISABLED: Endpoint disabled",
    );
  });
});

const YELP_DAILY_REPORT_URL_FOR_TEST = "https://api.yelp.com/v3/reporting/businesses/daily";
