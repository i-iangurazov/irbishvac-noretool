import { describe, expect, it, vi } from "vitest";
import { DashboardApiError, fetchApi } from "./api";

describe("fetchApi", () => {
  it("returns JSON for successful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true })
      }),
    );

    await expect(fetchApi("/dashboard/company-wide")).resolves.toEqual({ ok: true });
  });

  it("throws typed errors for API failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      }),
    );

    await expect(fetchApi("/dashboard/company-wide")).rejects.toBeInstanceOf(DashboardApiError);
  });
});
