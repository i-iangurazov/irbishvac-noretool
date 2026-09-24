import type { NextRequest } from "next/server";
import { proxyDashboardRequest } from "../proxy";

export async function GET(request: NextRequest) {
  const response = await proxyDashboardRequest(request, ["kitchen"]);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
