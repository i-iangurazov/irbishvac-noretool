import { describe, expect, it } from "vitest";
import { stableJson } from "./stable-json";

describe("stableJson", () => {
  it("treats object key order as insignificant", () => {
    const left = {
      z: 1,
      nested: {
        b: 2,
        a: 1
      }
    };

    const right = {
      nested: {
        a: 1,
        b: 2
      },
      z: 1
    };

    expect(stableJson(left)).toBe(stableJson(right));
  });

  it("preserves array order while normalizing nested object keys", () => {
    const left = [
      { b: 2, a: 1 },
      { d: 4, c: 3 }
    ];

    const right = [
      { a: 1, b: 2 },
      { c: 3, d: 4 }
    ];

    expect(stableJson(left)).toBe(stableJson(right));
  });

  it("treats tiny floating-point noise as equivalent", () => {
    expect(stableJson({ value: 32283.802499999998 })).toBe(
      stableJson({ value: 32283.8025 }),
    );
    expect(stableJson({ value: 0.023255813953488372 })).toBe(
      stableJson({ value: 0.02325581395348837 }),
    );
  });
});
