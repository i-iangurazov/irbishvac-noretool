export const IRBIS_EMAIL_DOMAIN = "irbishvac.com";

export function isAllowedIrbisEmail(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  const separatorIndex = normalized.lastIndexOf("@");

  return (
    separatorIndex > 0 &&
    normalized.slice(separatorIndex + 1) === IRBIS_EMAIL_DOMAIN
  );
}

export function isPublicAuthPath(pathname: string) {
  return (
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/sign-up" ||
    pathname.startsWith("/sign-up/") ||
    pathname === "/access-denied"
  );
}

export function resolvePublicRequestUrl(
  requestUrl: string,
  configuredOrigin: string | undefined,
) {
  const request = new URL(requestUrl);
  if (!configuredOrigin) {
    return request.toString();
  }

  const origin = new URL(configuredOrigin);
  if (origin.protocol !== "https:" && origin.protocol !== "http:") {
    throw new Error("DASHBOARD_PUBLIC_URL must use HTTP or HTTPS");
  }

  return new URL(`${request.pathname}${request.search}`, origin).toString();
}
