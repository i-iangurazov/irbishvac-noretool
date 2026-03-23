type AssetNameStyle = "slug" | "underscore" | "space";

type TechnicianPhotoResolverInput = {
  publicBaseUrl?: string | null;
  folder: string;
  name: string;
  photoUrl?: string | null;
  extension?: string;
  nameStyle?: AssetNameStyle;
};

type LogoResolverInput = {
  publicBaseUrl?: string | null;
  folder: string;
  key?: string | null;
};

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function sanitizeSegment(value: string) {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function joinPublicUrl(baseUrl: string, ...segments: Array<string | null | undefined>) {
  const normalizedBase = baseUrl.replace(/\/+$/g, "");
  const path = segments
    .filter((segment): segment is string => Boolean(segment && segment.trim()))
    .map((segment) => sanitizeSegment(segment))
    .filter(Boolean)
    .join("/");

  return path ? `${normalizedBase}/${path}` : normalizedBase;
}

export function formatAssetName(input: string, style: AssetNameStyle = "slug") {
  const normalized = input.normalize("NFKD").trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  if (style === "space") {
    return normalized.replace(/[\\/]+/g, " ");
  }

  const sanitized = normalized.replace(/[^\w\s-]/g, "");

  const separator = style === "underscore" ? "_" : "-";

  return sanitized
    .toLowerCase()
    .replace(/\s+/g, separator)
    .replace(/-+/g, style === "slug" ? "-" : "-");
}

export function resolveTechnicianPhotoUrl(input: TechnicianPhotoResolverInput) {
  const rawPhoto = input.photoUrl?.trim() ?? "";

  if (rawPhoto && isAbsoluteUrl(rawPhoto)) {
    return rawPhoto;
  }

  if (!input.publicBaseUrl) {
    return rawPhoto || null;
  }

  const key =
    rawPhoto ||
    (() => {
      const formattedName = formatAssetName(input.name, input.nameStyle ?? "slug");
      if (!formattedName) {
        return "";
      }

      const extension = (input.extension ?? "png").replace(/^\./, "");
      return `${formattedName}.${extension}`;
    })();

  if (!key) {
    return null;
  }

  return joinPublicUrl(input.publicBaseUrl, input.folder, key);
}

export function resolveLogoUrl(input: LogoResolverInput) {
  if (!input.publicBaseUrl || !input.key) {
    return null;
  }

  return joinPublicUrl(input.publicBaseUrl, input.folder, input.key);
}
