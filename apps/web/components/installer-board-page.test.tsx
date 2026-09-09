import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstallerBoardPage } from "./installer-board-page";

const { fetchApi, leaderboard } = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  leaderboard: vi.fn(),
}));
vi.mock("../lib/api", () => ({ fetchApi }));
vi.mock("./leaderboard-page", () => ({
  money: (value: number) => String(value),
  compactMoney: (value: number) => String(value),
  ratio: (value: number) => String(value),
  LeaderboardPage: (props: unknown) => {
    leaderboard(props);
    return null;
  },
}));

beforeEach(() => {
  vi.stubGlobal("React", React);
  leaderboard.mockClear();
  fetchApi.mockResolvedValue({
    rowsRanked: Array.from({ length: 13 }, (_, i) => ({
      name: `Test Installer ${i + 1}`,
      installedRevenue: 10_000 - i,
      jobsCompleted: i + 1,
      recallsCaused: 0,
      billableEfficiency: 0.9,
      averageInstall: 100,
    })),
    totals: {
      installedRevenue: 10_000,
      jobsCompleted: 13,
      recallsCaused: 0,
      billableEfficiencyAvg: 0.9,
    },
    snapshotTime: "2026-09-09T12:00:00Z",
  });
});

describe("install-only eight-person layout", () => {
  for (const path of [
    "/installers",
    "/plumbing-install",
    "/electrical-install",
  ]) {
    it(`scopes layout and page size correctly for ${path}`, async () => {
      renderToStaticMarkup(
        await InstallerBoardPage({
          path,
          apiPath: path.slice(1),
          title: "Install",
          subtitle: "",
          searchParams: { preset: "mtd", from: "2026-09-01", to: "2026-09-09" },
        }),
      );
      const props = leaderboard.mock.calls[0]?.[0];
      expect(props.maxVisibleItems).toBe(path === "/installers" ? 8 : 4);
      expect(props.showcaseVariant).toBe(
        path === "/installers" ? "install-eight" : "standard",
      );
      expect(props.items).toHaveLength(13);
      expect(
        props.items[0].stats.map((stat: { label: string }) => stat.label),
      ).toEqual([
        "Jobs Completed",
        "Recalls Caused",
        "Efficiency",
        "Average Install",
      ]);
    });
  }
});
