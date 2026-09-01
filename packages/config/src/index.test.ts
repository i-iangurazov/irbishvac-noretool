import { describe, expect, it } from "vitest";
import { getEnv } from "./env";
import { resolveBooleanFlag } from "./index";

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
      META_ACCESS_TOKEN: undefined,
      META_AD_ACCOUNT_IDS: undefined,
      META_GRAPH_API_VERSION: undefined,
    });

    expect(env.META_ACCESS_TOKEN).toBe("");
    expect(env.META_AD_ACCOUNT_IDS).toBe("");
    expect(env.META_GRAPH_API_VERSION).toBe("v23.0");
  });
});
