import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardApiError, fetchApi } from "./api";

const { headersMock } = vi.hoisted(() => ({
  headersMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

describe("fetchApi", () => {
  beforeEach(() => {
    headersMock.mockReset();
    headersMock.mockResolvedValue({
      get: (name: string) =>
        ({
          cookie: "__session=test-session",
          host: "dashboard.example.com",
          "x-forwarded-proto": "https",
        })[name] ?? null,
    });
  });

  it("returns JSON for successful responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchApi("/dashboard/company-wide")).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dashboard/company-wide",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(requestInit.headers).get("cookie")).toBe(
      "__session=test-session",
    );
  });

  it("throws typed errors for API failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    await expect(fetchApi("/dashboard/company-wide")).rejects.toBeInstanceOf(
      DashboardApiError,
    );
  });
});
