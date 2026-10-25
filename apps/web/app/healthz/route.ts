/** Public reachability only; contains no user, integration, or infrastructure data. */
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
