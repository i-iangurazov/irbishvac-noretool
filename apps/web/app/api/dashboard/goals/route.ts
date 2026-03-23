import { NextRequest } from "next/server";
import { proxyDashboardRequest } from "../proxy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return proxyDashboardRequest(request, ["goals"]);
}
