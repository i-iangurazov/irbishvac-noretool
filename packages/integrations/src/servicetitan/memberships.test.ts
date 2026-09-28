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

describe("membership audit and invoice reads", () => {
  it("follows export continuation tokens and rejects a repeated cursor", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: 1 }],
            hasMore: true,
            continueFrom: "cursor",
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: 2 }],
            hasMore: true,
            continueFrom: "cursor",
          }),
        ),
      );
    vi.stubGlobal("fetch", f);
    await expect(new MembershipSourceClient().statusHistory()).rejects.toThrow(
      "pagination",
    );
    expect(f.mock.calls[1]![0].searchParams.get("from")).toBe("cursor");
  });
  it("deducts only explicitly classified membership lines on an exactly matched invoice", async () => {
    const f = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hasMore: false,
          data: [
            {
              referenceNumber: "123",
              items: [
                { membershipTypeId: 0, total: "500.00" },
                { membershipTypeId: 42, total: "299.00" },
                { membershipTypeId: 42, total: "-25.00" },
              ],
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", f);
    expect(
      await new MembershipSourceClient().invoiceMembershipCharges("123"),
    ).toBe(274);
    expect(f.mock.calls[0]![0].searchParams.get("number")).toBe("123");
  });
  it("rejects an ignored invoice filter rather than subtracting an unrelated charge", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              hasMore: false,
              data: [{ referenceNumber: "wrong", items: [] }],
            }),
          ),
        ),
    );
    await expect(
      new MembershipSourceClient().invoiceMembershipCharges("123"),
    ).rejects.toThrow("matched exactly");
  });
});

it("respects the CRM limit of 50 IDs per lookup and validates returned identities", async () => {
  const f = vi.fn(
    async (url: URL) =>
      new Response(
        JSON.stringify({
          hasMore: false,
          data: url.searchParams
            .get("ids")!
            .split(",")
            .map((id) => ({ id: Number(id), type: "Residential" })),
        }),
      ),
  );
  vi.stubGlobal("fetch", f);
  const result = await new MembershipSourceClient().customerTypes(
    Array.from({ length: 68 }, (_, i) => String(i + 1)),
  );
  expect(result.size).toBe(68);
  expect(f).toHaveBeenCalledTimes(2);
  expect(f.mock.calls[0]![0].searchParams.get("ids")!.split(",")).toHaveLength(
    50,
  );
});
