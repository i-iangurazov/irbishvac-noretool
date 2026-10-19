import { NextRequest, NextResponse } from "next/server";
import {
  kitchenIdentity,
  validIssueMonth,
  newsletterPage,
} from "../../../../../../lib/kitchen-newsletter";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ page: string }> },
) {
  if (!(await kitchenIdentity()))
    return new NextResponse("Unauthorized", { status: 401 });
  const { page } = await params;
  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!validIssueMonth(month) || !["1", "2"].includes(page))
    return new NextResponse("Not found", { status: 404 });
  try {
    const image = await newsletterPage(month, Number(page));
    if (!image) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": image.mime,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new NextResponse("Newsletter temporarily unavailable", {
      status: 503,
    });
  }
}
