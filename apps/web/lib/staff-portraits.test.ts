import { afterEach, describe, expect, it, vi } from "vitest";
const findMany = vi.hoisted(() => vi.fn());
vi.mock("@irbis/db", () => ({ prisma: { staffPortrait: { findMany } } }));
import { preparedStaffPortraitUrls } from "./staff-portraits";
import { staffPortraitUrl } from "./staff-portrait-url";
afterEach(() => vi.resetAllMocks());
describe("reviewed Sales portraits", () => {
  it("uses exact text aliases and leaves unknown staff available for normal fallback", async () => {
    findMany.mockResolvedValue([
      { key: "reviewed-person", aliases: ["synthetic-person"] },
    ]);
    const result = await preparedStaffPortraitUrls([
      "Synthetic Person",
      "Unknown Person",
    ]);
    expect(result.get("Synthetic Person")).toBe(
      staffPortraitUrl("Synthetic Person"),
    );
    expect(result.has("Unknown Person")).toBe(false);
  });
  it("retains normal photo fallback if the portrait database is unavailable", async () => {
    findMany.mockRejectedValue(new Error("temporarily unavailable"));
    expect((await preparedStaffPortraitUrls(["Synthetic Person"])).size).toBe(
      0,
    );
  });
});
