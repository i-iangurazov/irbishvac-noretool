import { getConfig } from "@irbis/config";
import { resolveLogoUrl, resolveTechnicianPhotoUrl } from "@irbis/utils";

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
  const assets = getAssetConfig();

  return resolveTechnicianPhotoUrl({
    publicBaseUrl: assets.publicBaseUrl,
    folder: assets.technicianPhotoFolder,
    name,
    extension: assets.technicianPhotoExtension,
    nameStyle: assets.technicianPhotoNameStyle,
    ...(photoUrl === undefined ? {} : { photoUrl }),
  });
}
