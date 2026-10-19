const PORTRAIT_VERSION = "2026-10-19-1";
const PORTRAIT_PATH = "/api/staff/portraits/";

/** Text aliases only. Employee identities are never inferred from their photos. */
export function staffPortraitKey(name: string) {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function staffPortraitUrl(name: string, workerId?: string) {
  const key = workerId || staffPortraitKey(name);
  return `${PORTRAIT_PATH}${encodeURIComponent(key)}?v=${PORTRAIT_VERSION}`;
}

export function isPreparedStaffPortrait(src: string) {
  return src.startsWith(PORTRAIT_PATH);
}
