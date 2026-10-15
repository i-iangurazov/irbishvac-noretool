import { describe, expect, it } from "vitest";
import { buildCsrMissedCalls } from "./csr-missed-calls";
import { buildCsrPerformanceDashboard } from "./csr-performance";
import { emptyCsrSupplement } from "./csr-sources";

const stamp = "2026-10-15T07:00:00Z";
const users = [
  { id: "1", name: "Dana Pirmatova" },
  { id: "2", name: "Nina Naeem" },
  { id: "3", name: "Adele Aldyrakhman" },
];
const call = (id: string, extra: Record<string, string> = {}) => ({
  call_id: id,
  target_id: "1",
  target_type: "user",
  name: "Dana Pirmatova",
  date_started: "2026-10-10 15:58:58.44387",
  date_connected: "",
  direction: "inbound",
  is_internal: "false",
  categories: "inbound,missed,ring_no_answer,unanswered",
  ...extra,
});
const build = (rows: Record<string, string>[]) =>
  buildCsrMissedCalls(rows, users, "2026-10-10", "2026-10-10", stamp);

describe("CSR missed calls", () => {
  it("counts operator legs once, ignores parent records and internal calls, and preserves a miss after a callback", () => {
    const result = build([
      call("miss"),
      call("miss"),
      call("parent", { target_type: "department" }),
      call("internal", { is_internal: "true" }),
      call("callback", {
        direction: "outbound",
        categories: "outbound,outbound_connected",
        date_connected: "2026-10-10 15:59:21",
      }),
      call("abandoned", { categories: "inbound,abandoned,unanswered" }),
      call("supervisor", { participant_type: "listen_in" }),
      call("spam", { categories: "inbound,missed,spam" }),
      call("yesterday", { date_started: "2026-10-09 23:59:59" }),
      call("tomorrow", { date_started: "2026-10-11 00:00:00" }),
    ]);
    expect(result.byCsr).toEqual({
      "dana pirmatova": 1,
      "nina naeem": 0,
      "adele aldyrakhmanova": 0,
    });
    expect(result.source).toEqual({ status: "available", updatedAt: stamp });
  });
  it("counts a miss for each operator even when another operator answers", () => {
    expect(
      build([
        call("first"),
        call("second", { target_id: "2" }),
        call("answered", {
          target_id: "3",
          categories: "inbound,answered",
          date_connected: "2026-10-10 15:59:01",
        }),
      ]).byCsr,
    ).toEqual({
      "dana pirmatova": 1,
      "nina naeem": 1,
      "adele aldyrakhmanova": 0,
    });
  });
  it("rejects incomplete, inconsistent and ambiguous attribution rather than manufacturing zeros", () => {
    expect(() => build([call("a", { is_internal: "" })])).toThrow();
    expect(() =>
      build([call("a", { date_connected: "2026-10-10 15:59:01" })]),
    ).toThrow();
    expect(() => build([call("a"), call("a", { target_id: "2" })])).toThrow();
    expect(() =>
      buildCsrMissedCalls(
        [],
        [...users, { id: "4", name: "Dana Pirmatova" }],
        "2026-10-10",
        "2026-10-10",
        stamp,
      ),
    ).toThrow();
  });
  it("exposes numbers on cards, requires full team mapping, and never falls back to ST Abandoned", () => {
    const extra = emptyCsrSupplement("2026-10-10", "2026-10-10");
    const payload = {
      fields: ["Name", "CompanyRole", "CallsTaken"].map((name) => ({ name })),
      data: [
        ["Dana Pirmatova", "CSR", 5],
        ["Nina Naeem", "CSR", 5],
        ["Abandoned", "", 99],
      ],
    };
    expect(
      buildCsrPerformanceDashboard(payload, extra).summary.missedCalls,
    ).toBeNull();
    extra.missed = build([call("one")]);
    const result = buildCsrPerformanceDashboard(payload, extra);
    expect(result.rows.map((row) => row.missedCalls)).toEqual([1, 0]);
    expect(result.summary.missedCalls).toBe(1);
    payload.data.push(["Unmapped Person", "CSR", 3]);
    const incomplete = buildCsrPerformanceDashboard(payload, extra);
    expect(incomplete.rows.at(-1)?.missedCalls).toBeNull();
    expect(incomplete.summary.missedCalls).toBeNull();
  });
});
