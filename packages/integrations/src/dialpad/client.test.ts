import { afterEach, describe, expect, it, vi } from "vitest";
import { DialpadClient, dialpadStatsRequests, parseDialpadCsv } from "./client";
vi.mock("node:timers/promises", () => ({
  setTimeout: vi.fn().mockResolvedValue(undefined),
}));

const header =
  "call_id,date_started,target_id,name,direction,categories,is_internal,target_type";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Dialpad analytics client", () => {
  it("parses the actual export's quoted category lists, BOM, CRLF, escaped quotes and newlines", () => {
    const result = parseDialpadCsv(
      `\uFEFF${header}\r\n1,2026-10-10 15:58:58,2,"Name, \"\"quoted\"\"\nPerson",inbound,"inbound,missed,unanswered",false,user\r\n`,
    );
    expect(result[0]).toMatchObject({
      name: 'Name, "quoted"\nPerson',
      categories: "inbound,missed,unanswered",
    });
    expect(() => parseDialpadCsv(`${header}\n1,2026-10-10`)).toThrow();
    expect(() => parseDialpadCsv(`${header}\n"incomplete`)).toThrow();
    expect(() => parseDialpadCsv("call_id,name\n1,A")).toThrow();
    expect(parseDialpadCsv(header)).toEqual([]);
  });
  it("splits current-day and historical exports using LA dates, including a UTC date boundary", () => {
    const now = new Date("2026-10-15T01:00:00Z");
    expect(
      dialpadStatsRequests(
        "2026-10-01",
        "2026-10-14",
        now,
        "America/Los_Angeles",
      ),
    ).toEqual([
      {
        export_type: "records",
        stat_type: "calls",
        timezone: "America/Los_Angeles",
        days_ago_start: 1,
        days_ago_end: 13,
      },
      {
        export_type: "records",
        stat_type: "calls",
        timezone: "America/Los_Angeles",
        is_today: true,
      },
    ]);
    expect(
      dialpadStatsRequests(
        "2026-10-10",
        "2026-10-10",
        now,
        "America/Los_Angeles",
      )[0],
    ).toMatchObject({ days_ago_start: 4, days_ago_end: 4 });
    expect(() =>
      dialpadStatsRequests(
        "2026-10-20",
        "2026-10-21",
        now,
        "America/Los_Angeles",
      ),
    ).toThrow();
  });
  it("requires complete directory pagination and accepts Dialpad's string IDs", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          items: [{ id: "123", first_name: "Dana", last_name: "Pirmatova" }],
          cursor: "next",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          items: [{ id: "124", display_name: "Nina Naeem" }],
          cursor: null,
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await new DialpadClient("test-secret").listUsers()).toHaveLength(2);
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://dialpad.com/api/v2/users?cursor=next",
    );
    fetcher
      .mockReset()
      .mockImplementation(async () =>
        Response.json({ items: [], cursor: "repeat" }),
      );
    await expect(new DialpadClient("test-secret").listUsers()).rejects.toThrow(
      "Repeated",
    );
  });
  it("polls reports and never sends the credential to the download URL", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ request_id: "r1" }))
      .mockResolvedValueOnce(Response.json({ status: "processing" }))
      .mockResolvedValueOnce(
        Response.json({
          status: "complete",
          download_url: "https://dialpad.com/export/calls?signature=test",
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "/export/file?signature=test" },
        }),
      )
      .mockResolvedValueOnce(new Response(header));
    vi.stubGlobal("fetch", fetcher);
    const promise = new DialpadClient("test-secret").readCallLogs(
      "2026-10-10",
      "2026-10-10",
      new Date("2026-10-15T08:00:00Z"),
    );
    expect(await promise).toEqual([]);
    expect(fetcher.mock.calls.at(-1)?.[1]).not.toHaveProperty("headers");
  });
  it("rejects a failed export or untrusted download host without exposing remote text", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ request_id: "r1" }))
      .mockResolvedValueOnce(
        Response.json({ status: "failed", reason: "private customer content" }),
      );
    vi.stubGlobal("fetch", fetcher);
    const read = () =>
      new DialpadClient("test-secret").readCallLogs(
        "2026-10-10",
        "2026-10-10",
        new Date("2026-10-15T08:00:00Z"),
      );
    await expect(read()).rejects.toThrow("Dialpad report failed");
    fetcher
      .mockReset()
      .mockResolvedValueOnce(Response.json({ request_id: "r2" }))
      .mockResolvedValueOnce(
        Response.json({
          status: "complete",
          download_url: "https://example.com/private",
        }),
      );
    await expect(read()).rejects.toThrow(
      "Unexpected Dialpad report download host",
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
