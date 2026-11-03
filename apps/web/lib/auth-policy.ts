export const IRBIS_EMAIL_DOMAIN = "irbishvac.com";

// These routes enforce their own scoped bearer-key authentication.
export function isCampaignIntegrationPath(pathname: string) {
  return pathname === "/api/v1/campaigns" || pathname.startsWith("/api/v1/campaigns/");
}

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
  forwardedHost?: string | null,
  additionalOrigins?: string,
) {
  const request = new URL(requestUrl);
  if (!configuredOrigin) {
    return request.toString();
  }

  const parseOrigin = (value: string) => {
    const origin = new URL(value);
    if (origin.protocol !== "https:" && origin.protocol !== "http:") {
      throw new Error("DASHBOARD_PUBLIC_URL must use HTTP or HTTPS");
    }
    return origin;
  };
  const fallbackOrigin = parseOrigin(configuredOrigin);
  const origins = [fallbackOrigin, ...(additionalOrigins ?? "").split(",")
    .map((value) => value.trim()).filter(Boolean).map(parseOrigin)];
  const host = (forwardedHost ?? request.host).trim().toLowerCase();
  const origin = origins.find((value) => value.host.toLowerCase() === host) ?? fallbackOrigin;
  const result = new URL(origin.origin);
  result.pathname = request.pathname;
  result.search = request.search;
  return result.toString();
}

// Renderer runs in a private container, listens only on loopback, and rotates this
// token for every frozen package. This grants access only to report pages.
export function isLocalReportRenderRequest(
  requestUrl: string, token: string | null,
  env: Record<string, string | undefined>,
) {
  const url = new URL(requestUrl);
  const expected = env.PERFORMANCE_REPORT_RENDER_TOKEN;
  return env.PERFORMANCE_REPORT_RENDER_MODE === "true" &&
    Boolean(expected && expected.length >= 32 && token === expected) &&
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
    (url.pathname === "/performance" || url.pathname.startsWith("/performance/"));
}
