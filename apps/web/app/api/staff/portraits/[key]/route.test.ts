// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), portrait: vi.fn() }));
vi.mock("../../../../../lib/kitchen-newsletter", () => ({
  kitchenIdentity: mocks.identity,
}));
vi.mock("../../../../../lib/staff-portraits", () => ({
  staffPortrait: mocks.portrait,
  validStaffPortraitKey: (key: string) =>
    /^[a-z0-9][a-z0-9-]{1,119}$/.test(key),
}));
import { GET } from "./route";

const bytes = Buffer.from("reviewed portrait bytes");
const request = (etag?: string) =>
  new NextRequest(
    "https://dashboard.irbishvac.com/api/staff/portraits/test-person",
    {
      headers: etag ? { "if-none-match": etag } : {},
    },
  );
const context = (key = "test-person") => ({ params: Promise.resolve({ key }) });

beforeEach(() => {
  mocks.identity
    .mockReset()
    .mockResolvedValue({ userId: "authorized-display" });
  mocks.portrait.mockReset().mockResolvedValue({
    imageBytes: bytes,
    mimeType: "image/webp",
    checksum: "reviewed-sha256",
  });
});

describe("protected staff portrait images", () => {
  it("denies unauthenticated reads before accessing employee images", async () => {
    mocks.identity.mockResolvedValue(null);
    const response = await GET(request(), context());
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.portrait).not.toHaveBeenCalled();
  });

  it.each(["../private", "person.png", "person?key=other", "a".repeat(121)])(
    "rejects invalid portrait identifiers: %s",
    async (key) => {
      expect((await GET(request(), context(key))).status).toBe(404);
      expect(mocks.portrait).not.toHaveBeenCalled();
    },
  );

  it("returns the exact stored image with private caching and no sniffing", async () => {
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe(
      "private, max-age=300, must-revalidate",
    );
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("revalidates a cached portrait only after checking authentication", async () => {
    const response = await GET(request('"reviewed-sha256"'), context());
    expect(response.status).toBe(304);
    expect((await response.arrayBuffer()).byteLength).toBe(0);
    mocks.identity.mockResolvedValue(null);
    expect((await GET(request('"reviewed-sha256"'), context())).status).toBe(
      401,
    );
  });

  it("does not cache a missing photo, so a newly imported source appears immediately", async () => {
    mocks.portrait.mockResolvedValue(null);
    const response = await GET(request(), context());
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("handles a database failure without exposing connection details", async () => {
    mocks.portrait.mockRejectedValue(new Error("database credential"));
    const response = await GET(request(), context());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("credential");
  });
});
