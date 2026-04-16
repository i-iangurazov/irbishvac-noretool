import { describe, expect, it, vi } from "vitest";
import { DashboardController } from "./dashboard.controller";

describe("DashboardController", () => {
  it("keeps company-wide handler bound to the controller instance", async () => {
    const getCompanyWide = vi.fn().mockResolvedValue({ ok: true });
    const controller = new DashboardController({
      getTechnicians: vi.fn(),
      getPlumbingTechnicians: vi.fn(),
      getElectricalTechnicians: vi.fn(),
      getInstallers: vi.fn(),
      getPlumbingInstallers: vi.fn(),
      getElectricalInstallers: vi.fn(),
      getCompanyWide,
      getAdvisors: vi.fn(),
      getCallCenterSummary: vi.fn(),
      getCallCenterByCsr: vi.fn(),
      getLeadGeneration: vi.fn(),
      getCampaigns: vi.fn(),
      getTrending: vi.fn()
    } as never);

    const handler = controller.getCompanyWide;
    await expect(handler({})).resolves.toEqual({ ok: true });
    expect(getCompanyWide).toHaveBeenCalledTimes(1);
  });
});
