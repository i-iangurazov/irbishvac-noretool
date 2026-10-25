// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), redirect: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware:
    (handler: (auth: typeof mocks.auth, request: NextRequest) => unknown) =>
    (request: NextRequest) =>
      handler(mocks.auth, request),
}));
import middleware from "../middleware";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockReturnValue(new Response(null, { status: 302 }));
  mocks.auth.mockResolvedValue({
    isAuthenticated: false,
    redirectToSignIn: mocks.redirect,
  });
});
describe("expired dashboard requests", () => {
  it("exposes only the exact minimal health endpoint without authentication", async () => {
    expect(
      (
        await middleware(
          new NextRequest("https://dash.example/healthz"),
          {} as never,
        )
      )?.status,
    ).toBe(200);
    expect(mocks.auth).not.toHaveBeenCalled();
    await middleware(
      new NextRequest("https://dash.example/healthz/private"),
      {} as never,
    );
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });
  it("returns an uncached API 401 without redirecting to an HTML login document", async () => {
    const result = await middleware(
      new NextRequest("https://dash.example/api/dashboard/advisors"),
      {} as never,
    );
    expect(result!.status).toBe(401);
    expect(await result!.json()).toEqual({ error: "Unauthorized" });
    expect(result!.headers.get("cache-control")).toContain("no-store");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("continues to require sign-in on page navigation", async () => {
    const result = await middleware(
      new NextRequest("https://dash.example/advisors?tv=1"),
      {} as never,
    );
    expect(result!.status).toBe(302);
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });
});
