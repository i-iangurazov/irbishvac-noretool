import { beforeEach, describe, expect, it, vi } from "vitest";
const create = vi.hoisted(() => vi.fn());
vi.mock("@irbis/db", () => ({ prisma: { performancePersonnelSnapshot: { create } } }));
vi.mock("@irbis/integrations", () => ({ MembershipSourceClient: class {} }));
import { PersonnelRefreshRunner } from "./personnel";

describe("personnel ingestion", () => {
  beforeEach(() => { create.mockReset(); });

  it("persists only after both complete resources succeed", async () => {
    const list = vi.fn().mockResolvedValueOnce([{ id: 2, name: "HVAC - Service", active: true }]).mockResolvedValueOnce([{ id: 1, name: "A", businessUnitId: 2, active: true, isManagedTech: true }]);
    await new PersonnelRefreshRunner({ list } as never).refresh();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0].data.payloadJson.staff).toHaveLength(1);
  });

  it("preserves previous history when a source page fails", async () => {
    const list = vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("partial pagination"));
    await expect(new PersonnelRefreshRunner({ list } as never).refresh()).rejects.toThrow(/partial/);
    expect(create).not.toHaveBeenCalled();
  });
});
