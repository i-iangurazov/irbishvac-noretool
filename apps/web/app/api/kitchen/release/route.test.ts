import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), version: vi.fn() }));
vi.mock("../../../../lib/kitchen-newsletter", () => ({
  kitchenIdentity: mocks.identity,
}));
vi.mock("../../../../lib/kitchen-client-version", () => ({
  kitchenClientVersion: mocks.version,
}));
import { GET } from "./route";
beforeEach(() => {
  mocks.identity.mockReset();
  mocks.version.mockReset().mockResolvedValue("release-test");
});
describe("protected Kitchen release checks", () => {
  it("requires the existing dashboard identity", async () => {
    mocks.identity.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(mocks.version).not.toHaveBeenCalled();
  });
  it("returns only the uncached deployment identity", async () => {
    mocks.identity.mockResolvedValue({ userId: "dashboard-user" });
    const response = await GET();
    expect(await response.json()).toEqual({ version: "release-test" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
