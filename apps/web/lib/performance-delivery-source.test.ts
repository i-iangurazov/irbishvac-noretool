import {afterEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({fetchApi:vi.fn(),readFile:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("./api",()=>({fetchApi:mocks.fetchApi}));
vi.mock("node:fs/promises",()=>({readFile:mocks.readFile,default:{readFile:mocks.readFile}}));
import {loadServiceTechDeliverySnapshot} from "./performance-delivery-source";

describe("web coaching source",()=>{
  afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
  it("loads the authenticated current staff source when no frozen file is configured",async()=>{
    vi.stubEnv("PERFORMANCE_DELIVERY_SNAPSHOT_PATH","");
    mocks.fetchApi.mockResolvedValue({technicians:[{slug:"staff-1"}]});
    expect(await loadServiceTechDeliverySnapshot("staff-1")).toEqual({technicians:[{slug:"staff-1"}]});
    expect(mocks.fetchApi).toHaveBeenCalledWith("/dashboard/performance/coaching?staff=staff-1");
  });
  it("preserves the frozen PDF source without fetching live data",async()=>{
    vi.stubEnv("PERFORMANCE_DELIVERY_SNAPSHOT_PATH","/frozen/source.json");
    mocks.readFile.mockResolvedValue('{"cutoffDate":"2026-11-02"}');
    expect(await loadServiceTechDeliverySnapshot("staff-1")).toEqual({cutoffDate:"2026-11-02"});
    expect(mocks.fetchApi).not.toHaveBeenCalled();
  });
  it("keeps unavailable evidence explicit when the server source fails",async()=>{
    vi.stubEnv("PERFORMANCE_DELIVERY_SNAPSHOT_PATH","");
    mocks.fetchApi.mockRejectedValue(new Error("offline"));
    expect(await loadServiceTechDeliverySnapshot("staff-1")).toBeNull();
  });
});
