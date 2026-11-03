import {describe,expect,it} from "vitest";
import {companyFreshness} from "./company-freshness";
describe("Company-wide freshness",()=>{
  it("keeps a stale calls component visible even when trending is fresh",()=>{
    expect(companyFreshness([{snapshotTime:"2026-11-03T17:00:00Z"},{snapshotTime:"2026-11-03T11:00:00Z"}])).toEqual({freshness:"2026-11-03T11:00:00.000Z",hasCachedData:true});
  });
  it("does not mark a partially missing page as fully fresh",()=>{
    expect(companyFreshness([{snapshotTime:"2026-11-03T17:00:00Z"},{snapshotTime:null}])).toEqual({freshness:null,hasCachedData:true});
    expect(companyFreshness([{snapshotTime:"invalid"}])).toEqual({freshness:null,hasCachedData:false});
  });
});
