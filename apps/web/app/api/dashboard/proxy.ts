import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@irbis/config";
import { auth } from "@clerk/nextjs/server";
import { isAllowedIrbisEmail } from "../../../lib/auth-policy";

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
}

function buildTargetUrl(request: NextRequest, path: string[]) {
  const targetUrl = new URL(`/api/dashboard/${path.join("/")}`, getApiBaseUrl());
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

  return (
    authState.isAuthenticated &&
    isAllowedIrbisEmail(authState.sessionClaims.primaryEmail)
  );
}

export async function proxyDashboardRequest(request: NextRequest, path: string[]) {
  if (!(await authorizeDashboardRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const method = request.method;
  const body = method === "GET" || method === "HEAD" ? null : await request.text();
  const headers = buildProxyHeaders(request);
  const isCampaignPlanningWrite = method === "POST" && path.join("/") === "campaigns/performance/inputs";

  if (isCampaignPlanningWrite) {
    const writeToken = getConfig().auth.cookieSecret;
    headers.set("x-dashboard-write-token", writeToken);
  }

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store"
  };

  if (body !== null) {
    init.body = body;
  }

  const response = await fetch(buildTargetUrl(request, path), init);
  const responseBody = await response.text();

  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json"
    }
  });
}
