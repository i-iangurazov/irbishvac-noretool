import { getConfig } from "@irbis/config";
import { resolveLogoUrl, resolveTechnicianPhotoUrl } from "@irbis/utils";
import { isPreparedStaffPortrait } from "./staff-portrait-url";

function getAssetConfig() {
  return getConfig().assets;
}

export function getBrandLogoUrl() {
  const assets = getAssetConfig();

  return resolveLogoUrl({
    publicBaseUrl: assets.publicBaseUrl,
    folder: assets.logoFolder,
    key: assets.logoKey,
  });
}

export function resolveStaffHeadshotUrl(name: string, photoUrl?: string | null) {
  if (photoUrl && isPreparedStaffPortrait(photoUrl)) return photoUrl;
  const assets = getAssetConfig();
  const resolved = resolveTechnicianPhotoUrl({
    publicBaseUrl: assets.publicBaseUrl,
    folder: assets.technicianPhotoFolder,
    name,
    extension: assets.technicianPhotoExtension,
    nameStyle: assets.technicianPhotoNameStyle,
    ...(photoUrl === undefined ? {} : { photoUrl }),
  });

  if (
    !resolved ||
    !assets.publicBaseUrl ||
    !resolved.startsWith(assets.publicBaseUrl)
  ) {
    return resolved;
  }

  return `/_next/image?url=${encodeURIComponent(resolved)}&w=640&q=82`;
}
