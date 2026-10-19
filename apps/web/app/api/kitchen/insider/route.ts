import { NextRequest, NextResponse } from "next/server";
// sharp 0.35 exposes runtime exports without a types condition.
import { createRequire } from "node:module";
import type sharpType from "../../../../node_modules/sharp/lib/index";
const loadSharp = createRequire(import.meta.url);
const sharp: typeof sharpType = loadSharp("sharp");
import {
  kitchenIdentity,
  kitchenCanUpload,
  validIssueMonth,
  newsletterInfo,
  saveNewsletter,
  type NewsletterPage,
} from "../../../../lib/kitchen-newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const identity = await kitchenIdentity();
  if (!identity)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!validIssueMonth(month))
    return NextResponse.json(
      { error: "Choose an issue month." },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      {
        issue: await newsletterInfo(month),
        canUpload: kitchenCanUpload(identity.userId),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Newsletter temporarily unavailable." },
      { status: 503 },
    );
  }
}

const MAX_BODY = 16 * 1024 * 1024;
async function boundedJson(request: NextRequest) {
  if (Number(request.headers.get("content-length")) > MAX_BODY)
    throw new Error("Too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing upload");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.length;
    if (size > MAX_BODY) {
      await reader.cancel();
      throw new Error("Too large");
    }
    chunks.push(item.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function POST(request: NextRequest) {
  const identity = await kitchenIdentity();
  if (!identity || !kitchenCanUpload(identity.userId))
    return NextResponse.json(
      { error: "Sign in with your individual IRBIS account to upload." },
      { status: 403 },
    );
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host;
  let sameOrigin = false;
  try {
    sameOrigin = Boolean(origin && new URL(origin).host === host);
  } catch {
    /* Invalid origins are rejected. */
  }
  if (!sameOrigin || request.headers.get("x-kitchen-upload") !== "1")
    return NextResponse.json(
      { error: "Invalid upload request." },
      { status: 403 },
    );
  try {
    const input = await boundedJson(request);
    if (
      !validIssueMonth(String(input.month)) ||
      !Array.isArray(input.pages) ||
      input.pages.length !== 2
    )
      throw new Error("Choose a month and exactly two pages.");
    const pages: NewsletterPage[] = [];
    for (const value of input.pages) {
      if (
        typeof value !== "string" ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
      )
        throw new Error("Use PNG, JPEG or WebP page images.");
      const buffer = Buffer.from(value.slice(value.indexOf(",") + 1), "base64");
      const image = sharp(buffer, {
        limitInputPixels: 24_000_000,
        animated: false,
      });
      const meta = await image.metadata();
      if (
        !meta.width ||
        !meta.height ||
        meta.width < 300 ||
        meta.height < 400 ||
        meta.width / meta.height > 1 ||
        meta.width / meta.height < 0.4 ||
        (meta.pages ?? 1) !== 1
      )
        throw new Error(
          "Each newsletter page must be a single portrait image, at least 300 × 400 pixels.",
        );
      const bytes = await image
        .rotate()
        .resize({
          width: 1600,
          height: 2200,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 95 })
        .toBuffer();
      pages.push({ mime: "image/webp", data: bytes.toString("base64") });
    }
    const source =
      typeof input.sourceName === "string"
        ? Array.from(input.sourceName as string)
            .filter((character) => character.charCodeAt(0) >= 32)
            .join("")
            .slice(0, 160)
        : "IRBIS Insider";
    await saveNewsletter(input.month, pages, source, identity.userId!);
    return NextResponse.json(
      { issue: await newsletterInfo(input.month) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error &&
      !/prisma|database|connection|query/i.test(error.message)
        ? error.message.slice(0, 200)
        : "Could not save the newsletter. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
