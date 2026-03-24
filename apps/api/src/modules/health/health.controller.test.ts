import { describe, expect, it, vi } from "vitest";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("keeps service methods bound when used as route handlers", async () => {
    const service = {
      getLiveness: vi.fn(() => ({ ok: true })),
      getReadiness: vi.fn(async () => ({ ok: true, checks: {} }))
    };

    const controller = new HealthController(service as never);
    const { getHealth, getReadiness } = controller;

    expect(getHealth()).toEqual({ ok: true });
    await expect(getReadiness()).resolves.toEqual({ ok: true, checks: {} });
    expect(service.getLiveness).toHaveBeenCalledTimes(1);
    expect(service.getReadiness).toHaveBeenCalledTimes(1);
  });
});
