import { describe, expect, it } from "vitest";
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
