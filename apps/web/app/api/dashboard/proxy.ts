import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@irbis/config";
import { auth } from "@clerk/nextjs/server";
import { isAllowedDashboardIdentity, SHARED_DASHBOARD_USER_ID } from "../../../lib/dashboard-identity";

function getApiBaseUrl() {
  return (
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3001"
  );
}

function buildTargetUrl(request: NextRequest, path: string[]) {
  const targetUrl = new URL(
    `/api/dashboard/${path.join("/")}`,
    getApiBaseUrl(),
  );
  targetUrl.search = request.nextUrl.search;
  return targetUrl;
}

function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers();
  const accept = request.headers.get("accept");
  const contentType = request.headers.get("content-type");

  if (accept) {
    headers.set("accept", accept);
  }

  if (contentType) {
    headers.set("content-type", contentType);
  }

  headers.set("x-dashboard-access-token", getConfig().auth.cookieSecret);

  return headers;
}

async function authorizeDashboardRequest() {
  const authState = await auth();

  const allowed = isAllowedDashboardIdentity({
    isAuthenticated: authState.isAuthenticated,
    userId: authState.userId,
    primaryEmail: authState.sessionClaims?.primaryEmail,
  });
  return allowed ? authState : null;
}

export async function proxyDashboardRequest(
  request: NextRequest,
  path: string[],
) {
  const identity = await authorizeDashboardRequest();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const method = request.method;
  const body =
    method === "GET" || method === "HEAD" ? null : await request.text();
  const headers = buildProxyHeaders(request);
  const isMembershipNote =
    method === "POST" &&
    /^call-center\/memberships\/services\/\d+\/notes$/.test(path.join("/"));
  if (isMembershipNote) {
    const origin = request.headers.get("origin");
    const publicHost =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      request.nextUrl.host;
    let sameOrigin = false;
    try {
      sameOrigin = Boolean(origin && new URL(origin).host === publicHost);
    } catch {
      /* Reject malformed origins. */
    }
    if (!sameOrigin || request.headers.get("x-membership-note") !== "1") {
      return NextResponse.json(
        { error: "Invalid note request" },
        { status: 403 },
      );
    }
    headers.set("x-dashboard-user-id", identity.userId!);
    headers.set(
      "x-dashboard-user-label",
      identity.userId === SHARED_DASHBOARD_USER_ID ? "Shared dashboard" : String(identity.sessionClaims?.primaryEmail ?? ""),
    );
  }
  const isCampaignPlanningWrite =
    method === "POST" && path.join("/") === "campaigns/performance/inputs";

  if (isCampaignPlanningWrite) {
    const writeToken = getConfig().auth.cookieSecret;
    headers.set("x-dashboard-write-token", writeToken);
  }

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };

  if (body !== null) {
    init.body = body;
  }

  const response = await fetch(buildTargetUrl(request, path), init);
  const responseBody = await response.text();

  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ?? "application/json",
    },
  });
}
