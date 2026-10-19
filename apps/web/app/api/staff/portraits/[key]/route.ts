import { NextRequest, NextResponse } from "next/server";
import { kitchenIdentity } from "../../../../../lib/kitchen-newsletter";
import {
  staffPortrait,
  validStaffPortraitKey,
} from "../../../../../lib/staff-portraits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await kitchenIdentity()))
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  const { key } = await params;
  if (!validStaffPortraitKey(key))
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  try {
    const image = await staffPortrait(key);
    if (!image)
      return new NextResponse("Not found", {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });
    const headers = {
      "Content-Type": image.mimeType,
      "Cache-Control": "private, max-age=300, must-revalidate",
      ETag: `"${image.checksum}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      Vary: "Cookie",
    };
    if (request.headers.get("if-none-match") === headers.ETag)
      return new NextResponse(null, { status: 304, headers });
    return new NextResponse(new Uint8Array(image.imageBytes), { headers });
  } catch {
    return new NextResponse("Portrait temporarily unavailable", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
