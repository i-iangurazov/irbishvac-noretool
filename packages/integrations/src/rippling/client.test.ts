import { describe, expect, it, vi } from "vitest";
import { RipplingClient } from "./client";

const response = (results: unknown[], next_link: string | null = null) =>
  new Response(JSON.stringify({ results, next_link }), { status: 200 });

describe("Rippling read-only client", () => {
  it("reads every page with the pinned API version", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(
          [{ id: "1" }],
          "https://rest.ripplingapis.com/workers/?cursor=next",
        ),
      )
      .mockResolvedValueOnce(response([{ id: "2" }]));
    expect(
      await new RipplingClient("secret", "2024-08-01", request).list("workers"),
    ).toEqual([{ id: "1" }, { id: "2" }]);
    expect(request).toHaveBeenCalledTimes(2);
    const options = request.mock.calls[0]?.[1];
    expect(options).toMatchObject({
      headers: {
        "Rippling-Api-Version": "2024-08-01",
        Authorization: "Bearer secret",
      },
      redirect: "error",
    });
  });

  it("never forwards a token to an untrusted pagination host", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response([{ id: "1" }], "https://attacker.example/workers/"),
      );
    await expect(
      new RipplingClient("secret", "2024-08-01", request).list("workers"),
    ).rejects.toThrow("invalid_pagination");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("fails the whole read if a later page is forbidden and never includes response secrets in errors", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(
          [{ id: "1" }],
          "https://rest.ripplingapis.com/workers/?cursor=next",
        ),
      );
    request.mockResolvedValueOnce(
      new Response("PRIVATE_BODY secret", { status: 403 }),
    );
    await expect(
      new RipplingClient("secret", "2024-08-01", request).list("workers"),
    ).rejects.toThrow("Rippling request_failed (403)");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("retries throttling and server errors, then succeeds", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("", { status: 429, headers: { "retry-after": "2" } }),
      )
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(response([{ id: "1" }]));
    const wait = vi.fn().mockResolvedValue(undefined);
    expect(
      await new RipplingClient("secret", "2024-08-01", request, wait).list(
        "workers",
      ),
    ).toHaveLength(1);
    expect(wait.mock.calls.map((call) => call[0])).toEqual([2000, 2000]);
  });

  it("rejects repeated cursors and malformed bodies", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response([], "https://rest.ripplingapis.com/workers/?limit=100"),
      );
    await expect(
      new RipplingClient("secret", "2024-08-01", request).list("workers"),
    ).rejects.toThrow("invalid_pagination");
    const invalid = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"results":[{}]}'));
    await expect(
      new RipplingClient("secret", "2024-08-01", invalid).list("users"),
    ).rejects.toThrow("invalid_response");
  });
});
