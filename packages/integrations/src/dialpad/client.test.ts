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
  it("covers every requested YTD date exactly once across bounded windows and a separate today export", () => {
    const requests = dialpadStatsRequests(
      "2026-01-01",
      "2026-10-19",
      new Date("2026-10-19T20:00:00Z"),
      "America/Los_Angeles",
    );
    const historical = requests.filter((request) => !request.is_today);
    expect(historical).toHaveLength(10);
    const days = historical.flatMap((request) => {
      const size = request.days_ago_end! - request.days_ago_start! + 1;
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThanOrEqual(31);
      return Array.from(
        { length: size },
        (_, index) => request.days_ago_start! + index,
      );
    });
    expect(days).toHaveLength(291);
    expect(new Set(days).size).toBe(291);
    expect(Math.min(...days)).toBe(1);
    expect(Math.max(...days)).toBe(291);
    expect(requests.filter((request) => request.is_today)).toHaveLength(1);
    const leap = dialpadStatsRequests(
      "2024-02-28",
      "2024-03-31",
      new Date("2024-04-01T20:00:00Z"),
      "America/Los_Angeles",
    );
    expect(
      leap.map((request) => [request.days_ago_start, request.days_ago_end]),
    ).toEqual([
      [3, 33],
      [1, 2],
    ]);
  });
  it("limits concurrent exports and rejects the entire result when a later window fails", async () => {
    const client = new DialpadClient("test-secret");
    let active = 0;
    let peak = 0;
    let calls = 0;
    const report = vi
      .spyOn(client as any, "callReport")
      .mockImplementation(async () => {
        active++;
        peak = Math.max(peak, active);
        const index = calls++;
        await Promise.resolve();
        active--;
        if (index === 2) throw new Error("export unavailable");
        return [{ call_id: String(index) }];
      });
    await expect(
      client.readCallLogs(
        "2026-01-01",
        "2026-04-30",
        new Date("2026-05-01T20:00:00Z"),
      ),
    ).rejects.toThrow("export unavailable");
    expect(peak).toBe(2);
    expect(report).toHaveBeenCalledTimes(4);
    report.mockRestore();
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
  it("retries interrupted GETs without creating another export or leaking its credential", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ request_id: "r1" }))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        Response.json({
          status: "complete",
          download_url: "https://storage.googleapis.com/test/calls.csv",
        }),
      )
      .mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"))
      .mockResolvedValueOnce(new Response(header));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      new DialpadClient("test-secret").readCallLogs(
        "2026-10-10",
        "2026-10-10",
        new Date("2026-10-15T08:00:00Z"),
      ),
    ).resolves.toEqual([]);
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === "POST"),
    ).toHaveLength(1);
    expect(fetcher.mock.calls[1]?.[0]).toBe(fetcher.mock.calls[2]?.[0]);
    for (const [, options] of fetcher.mock.calls.slice(3))
      expect(options).not.toHaveProperty("headers");
  });
  it("bounds failed GET retries and does not retry report creation", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetcher);
    const client = new DialpadClient("test-secret");
    await expect(client.listUsers()).rejects.toThrow("fetch failed");
    expect(fetcher).toHaveBeenCalledTimes(3);
    fetcher.mockClear();
    await expect(
      client.readCallLogs(
        "2026-10-10",
        "2026-10-10",
        new Date("2026-10-15T08:00:00Z"),
      ),
    ).rejects.toThrow("fetch failed");
    expect(fetcher).toHaveBeenCalledTimes(1);
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
