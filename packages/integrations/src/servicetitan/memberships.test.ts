import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@irbis/config", () => ({
  getConfig: () => ({ serviceTitan: { tenantId: "test", appKey: "test" } }),
}));
vi.mock("./client", () => ({
  ServiceTitanClient: class {
    getAccessToken() {
      return Promise.resolve("test-token");
    }
  },
}));
import { MembershipSourceClient } from "./memberships";
afterEach(() => vi.unstubAllGlobals());
const response = (data: unknown[], hasMore: boolean, totalCount: number) =>
  new Response(JSON.stringify({ data, hasMore, totalCount }));
describe("membership source reads", () => {
  it("reads every page including inactive records and never makes a write request", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: 1 }], true, 2))
      .mockResolvedValueOnce(response([{ id: 2 }], false, 2));
    vi.stubGlobal("fetch", fetcher);
    expect(await new MembershipSourceClient().list("memberships")).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    expect(fetcher.mock.calls[1]![0].searchParams.get("page")).toBe("2");
    expect(fetcher.mock.calls[0]![0].searchParams.get("active")).toBe("Any");
    expect(fetcher.mock.calls[0]![1].method).toBeUndefined();
  });
  it("rejects incomplete pagination instead of producing a partial total", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response([{ id: 1 }], false, 2)),
    );
    await expect(
      new MembershipSourceClient().list("memberships"),
    ).rejects.toThrow("Incomplete");
  });
  it("treats access failures as unavailable and does not leak response bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("private upstream details", { status: 403 }),
        ),
    );
    await expect(
      new MembershipSourceClient().list("memberships"),
    ).rejects.toThrow("unavailable (403)");
  });
});
