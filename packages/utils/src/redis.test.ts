import { describe, expect, it } from "vitest";
import { getRedisConnectionSettings } from "./redis";

describe("getRedisConnectionSettings", () => {
  it("enables tls automatically for rediss urls", () => {
    const settings = getRedisConnectionSettings("rediss://default:secret@example.com:6379");

    expect(settings.tls).toEqual({});
    expect(settings.host).toBe("example.com");
    expect(settings.port).toBe(6379);
  });

  it("enables tls automatically for upstash hosts even when the url uses redis", () => {
    const settings = getRedisConnectionSettings(
      "redis://default:secret@hardy-jay-81595.upstash.io:6379",
    );

    expect(settings.tls).toEqual({});
    expect(settings.host).toBe("hardy-jay-81595.upstash.io");
  });

  it("keeps local redis urls non-tls", () => {
    const settings = getRedisConnectionSettings("redis://localhost:6379");

    expect(settings.tls).toBeUndefined();
    expect(settings.host).toBe("localhost");
  });
});
