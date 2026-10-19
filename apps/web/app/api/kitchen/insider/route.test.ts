// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";
const load = createRequire(import.meta.url);
const sharp = load("sharp");
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  save: vi.fn(),
  info: vi.fn(),
  page: vi.fn(),
}));
vi.mock("../../../../lib/kitchen-newsletter", () => ({
  kitchenIdentity: mocks.identity,
  kitchenCanUpload: (id: string) => id !== "shared",
  validIssueMonth: (month: string) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(month),
  newsletterInfo: mocks.info,
  newsletterPage: mocks.page,
  saveNewsletter: mocks.save,
}));
import { GET, POST } from "./route";
const request = (body: unknown, origin = "https://dashboard.irbishvac.com") =>
  new NextRequest("https://dashboard.irbishvac.com/api/kitchen/insider", {
    method: "POST",
    headers: {
      origin,
      host: "dashboard.irbishvac.com",
      "content-type": "application/json",
      "x-kitchen-upload": "1",
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  mocks.identity.mockResolvedValue({ userId: "individual" });
  mocks.save.mockReset().mockResolvedValue(undefined);
  mocks.info.mockResolvedValue({ month: "2026-10", pages: ["one", "two"] });
});
describe("monthly newsletter access and validation", () => {
  it("requires authentication to read", async () => {
    mocks.identity.mockResolvedValue(null);
    expect(
      (
        await GET(
          new NextRequest(
            "https://dashboard.irbishvac.com/api/kitchen/insider?month=2026-10",
          ),
        )
      ).status,
    ).toBe(401);
  });
  it("keeps the shared display account read-only", async () => {
    mocks.identity.mockResolvedValue({ userId: "shared" });
    expect((await POST(request({}))).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it.each(["https://external.example", "invalid-origin"])(
    "rejects cross-site or malformed origin %s",
    async (origin) => {
      expect((await POST(request({}, origin))).status).toBe(403);
    },
  );
  it("rejects oversized bodies before parsing", async () => {
    const req = request({});
    req.headers.set("content-length", String(17 * 1024 * 1024));
    expect((await POST(req)).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects an invalid month or a missing page", async () => {
    expect((await POST(request({ month: "2026-13", pages: [] }))).status).toBe(
      400,
    );
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects SVG and invalid image bytes without replacing the current issue", async () => {
    expect(
      (
        await POST(
          request({
            month: "2026-10",
            pages: [
              "data:image/svg+xml;base64,PHN2Zz4=",
              "data:image/png;base64,YQ==",
            ],
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("validates both pages and stores sanitized images atomically", async () => {
    const image = await sharp({
      create: { width: 600, height: 800, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const url = `data:image/png;base64,${image.toString("base64")}`;
    const result = await POST(
      request({
        month: "2026-10",
        pages: [url, url],
        sourceName: "October\u0000.pdf",
      }),
    );
    expect(result.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledOnce();
    const [month, pages, source, user] = mocks.save.mock.calls[0]!;
    expect(month).toBe("2026-10");
    expect(source).toBe("October.pdf");
    expect(user).toBe("individual");
    expect(pages).toHaveLength(2);
    expect(pages[0].mime).toBe("image/webp");
    expect(
      (await sharp(Buffer.from(pages[0].data, "base64")).metadata()).width,
    ).toBe(600);
  });
});

describe("protected newsletter page retrieval", () => {
  const imageRequest = (month = "2026-10") =>
    new NextRequest(
      `https://dashboard.irbishvac.com/api/kitchen/insider/page/1?month=${month}`,
    );
  const context = (page = "1") => ({ params: Promise.resolve({ page }) });
  it("requires authentication for the image bytes", async () => {
    const { GET: readPage } = await import("./page/[page]/route");
    mocks.identity.mockResolvedValue(null);
    expect((await readPage(imageRequest(), context())).status).toBe(401);
  });
  it("rejects invalid months and page numbers", async () => {
    const { GET: readPage } = await import("./page/[page]/route");
    expect((await readPage(imageRequest("2026-13"), context())).status).toBe(
      404,
    );
    expect((await readPage(imageRequest(), context("3"))).status).toBe(404);
  });
  it("returns the stored image bytes with private caching and no content sniffing", async () => {
    const { GET: readPage } = await import("./page/[page]/route");
    const bytes = await sharp({
      create: { width: 600, height: 800, channels: 3, background: "white" },
    })
      .webp()
      .toBuffer();
    mocks.page.mockResolvedValue({ bytes, mime: "image/webp" });
    const response = await readPage(imageRequest(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  });
  it("handles an absent issue and database failure without leaking details", async () => {
    const { GET: readPage } = await import("./page/[page]/route");
    mocks.page.mockResolvedValueOnce(null);
    expect((await readPage(imageRequest(), context())).status).toBe(404);
    mocks.page.mockRejectedValueOnce(new Error("database secret"));
    const response = await readPage(imageRequest(), context());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
  });
});
