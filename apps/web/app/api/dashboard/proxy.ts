import { NextRequest, NextResponse } from "next/server";

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

  return headers;
}

export async function proxyDashboardRequest(request: NextRequest, path: string[]) {
  const method = request.method;
  const body = method === "GET" || method === "HEAD" ? null : await request.text();
  const init: RequestInit = {
    method,
    headers: buildProxyHeaders(request),
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
