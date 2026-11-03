import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPerformancePersonnelDirectory, buildTechnicianDashboard } from "@irbis/domain";
const findFirst = vi.hoisted(() => vi.fn());
vi.mock("@irbis/db", () => ({ prisma: { performancePersonnelSnapshot: { findFirst }, performanceGoalVersion: { findMany: async () => [] } } }));
vi.mock("@irbis/config", () => ({ getConfig: () => ({ personnel: { maxAgeMinutes: 60 } }) }));
import { PersonnelService } from "./personnel.service";

describe("server personnel directory", () => {
  beforeEach(() => { findFirst.mockReset(); });

  it("uses the latest complete export for dashboard composition", async () => {
    const directory = buildPerformancePersonnelDirectory([{ id: 1, name: "New tech", active: true, isManagedTech: true, businessUnitId: 2 }], [{ id: 2, name: "HVAC - Service", active: true }]);
    findFirst.mockResolvedValue({ payloadJson: directory });
    const result = await new PersonnelService().technicians(buildTechnicianDashboard([]));
    expect(result.rows[0]?.name).toBe("New tech");
    expect(findFirst).toHaveBeenCalledWith({ orderBy: { fetchedAt: "desc" } });
  });

  it("fails explicitly on missing, stale or unreachable directory instead of using metric rows as membership", async () => {
    const service = new PersonnelService();
    findFirst.mockResolvedValue(null);
    await expect(service.directory()).rejects.toMatchObject({ status: 503 });
    findFirst.mockResolvedValue({ payloadJson: buildPerformancePersonnelDirectory([], [], "2026-01-01T00:00:00Z") });
    await expect(service.directory()).rejects.toMatchObject({ status: 503 });
    findFirst.mockRejectedValue(new Error("database unavailable"));
    await expect(service.directory()).rejects.toMatchObject({ status: 503 });
  });
});
