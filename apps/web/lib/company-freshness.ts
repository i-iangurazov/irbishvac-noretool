/** The page is only as fresh as its oldest component, not the first loaded one. */
export function companyFreshness(components: Array<{snapshotTime?:string|null}>) {
  const times=components.map(component=>component.snapshotTime ? Date.parse(component.snapshotTime) : NaN);
  const valid=times.filter(Number.isFinite);
  return {
    freshness:valid.length===times.length && valid.length>0 ? new Date(Math.min(...valid)).toISOString() : null,
    hasCachedData:valid.length>0,
  };
}
