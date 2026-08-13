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
