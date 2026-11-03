import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@irbis/config', () => ({getConfig:()=>({serviceTitan:{tenantId:'test',appKey:'test',clientId:'test',clientSecret:'test'}})}));
import { ServiceTitanClient } from './client';
afterEach(()=>vi.unstubAllGlobals());
const options={family:'advisors' as const,category:'operations',reportId:'1',parameters:[],correlationId:'test'};
function setup(pages:unknown[]){
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:'test'})));
 for(const page of pages)fetcher.mockResolvedValueOnce(new Response(JSON.stringify(page)));
 vi.stubGlobal('fetch',fetcher); return fetcher;
}
describe('complete paginated performance reports',()=>{
 it('collects all pages and preserves field definitions',async()=>{
  setup([{fields:['id'],data:[[1]],hasMore:true,totalCount:2},{fields:['id'],data:[[2]],hasMore:false,totalCount:2}]);
  expect((await new ServiceTitanClient().fetchPaginatedReport(options)).payload.data).toEqual([[1],[2]]);
 });
 it.each([
  {fields:['id'],data:[[1]],hasMore:false,totalCount:2},
  {fields:['id'],data:[[1]]},
  {fields:['id'],data:[],hasMore:true,totalCount:2},
 ])('rejects partial or ambiguous data',async(page)=>{
  setup([page]); await expect(new ServiceTitanClient().fetchPaginatedReport(options)).rejects.toThrow(/Incomplete/);
 });
});
