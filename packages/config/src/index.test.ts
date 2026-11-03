import { describe, expect, it } from "vitest";
import { getEnv } from "./env";
import {
  parseSpreadsheetIdsByMonth,
  resolveBooleanFlag,
  resolveMonthlySpreadsheetId,
} from "./index";

// Tests use explicit dummy settings, never a developer's private credentials.
const TEST_ENV = {
  DATABASE_URL: "postgresql://test:test@localhost/test", REDIS_URL: "redis://localhost:6379",
  AUTH_COOKIE_SECRET: "test-cookie-secret", AUTH_DEFAULT_ADMIN_EMAIL: "test@example.com",
  AUTH_DEFAULT_ADMIN_PASSWORD: "test-password", NEXT_PUBLIC_APP_NAME: "Test",
  SERVICETITAN_CLIENT_ID: "test", SERVICETITAN_CLIENT_SECRET: "test", SERVICETITAN_TENANT_ID: "1",
  ST_REPORT_TECHNICIANS: "1", ST_REPORT_INSTALLERS: "1", ST_REPORT_ADVISORS: "1",
  ST_REPORT_CALL_CENTER_SOURCE: "1", ST_REPORT_CALL_CENTER_PERFORMANCE: "1", ST_REPORT_LEADS: "1",
  ST_REPORT_CAMPAIGNS: "1", ST_REPORT_BOOKING_RATE: "1", ST_REPORT_TRENDING: "1", ST_REPORT_SALES: "1",
  ST_REPORT_REVENUE_MONTHLY_PACE: "1", ST_BU_INSTALLERS: "1", ST_BU_ADVISORS: "1", ST_BU_COMPANY: "1",
};

describe("resolveBooleanFlag", () => {
  it("uses the provided default when the env var is unset", () => {
    expect(resolveBooleanFlag(undefined, true)).toBe(true);
    expect(resolveBooleanFlag(undefined, false)).toBe(false);
  });

  it("parses explicit true and false values", () => {
    expect(resolveBooleanFlag("true", false)).toBe(true);
    expect(resolveBooleanFlag("false", true)).toBe(false);
  });
});

describe("Field Pro report defaults", () => {
  it("boots when Railway has not defined the optional report ids", () => {
    const env = getEnv({
      ...TEST_ENV,
      ST_REPORT_FIELD_PRO_TECHNICIAN_ACTIVITY: undefined,
      ST_REPORT_FIELD_PRO_JOB_RECORDINGS: undefined,
    });

    expect(env.ST_REPORT_FIELD_PRO_TECHNICIAN_ACTIVITY).toBe("125959497");
    expect(env.ST_REPORT_FIELD_PRO_JOB_RECORDINGS).toBe("125959432");
  });
});

describe("Yelp reporting configuration", () => {
  it("keeps Yelp optional until credentials are configured", () => {
    const env = getEnv({
      ...TEST_ENV,
      YELP_API_KEY: undefined,
      YELP_BUSINESS_IDS: undefined,
    });

    expect(env.YELP_API_KEY).toBe("");
    expect(env.YELP_BUSINESS_IDS).toBe("");
  });
});

describe("Meta Ads reporting configuration", () => {
  it("keeps Meta optional and provides a versioned API default", () => {
    const env = getEnv({
      ...TEST_ENV,
      META_ACCESS_TOKEN: undefined,
      META_AD_ACCOUNT_IDS: undefined,
      META_GRAPH_API_VERSION: undefined,
    });

    expect(env.META_ACCESS_TOKEN).toBe("");
    expect(env.META_AD_ACCOUNT_IDS).toBe("");
    expect(env.META_GRAPH_API_VERSION).toBe("v23.0");
  });
});

describe("monthly Call Center spreadsheet configuration", () => {
  it("uses a month-specific sheet and preserves the default fallback", () => {
    const byMonth = parseSpreadsheetIdsByMonth(
      '{"2026-09":"september-sheet"}',
    );

    expect(resolveMonthlySpreadsheetId("august-sheet", byMonth, "2026-08")).toBe(
      "august-sheet",
    );
    expect(resolveMonthlySpreadsheetId("august-sheet", byMonth, "2026-09")).toBe(
      "september-sheet",
    );
  });

  it("rejects malformed month mappings at startup", () => {
    expect(() => parseSpreadsheetIdsByMonth('{"September":"sheet"}')).toThrow(
      "expected YYYY-MM",
    );
    expect(() => parseSpreadsheetIdsByMonth('{"2026-09":""}')).toThrow(
      "is empty",
    );
    expect(() => parseSpreadsheetIdsByMonth("not-json")).toThrow(
      "must be a JSON object",
    );
  });
});
