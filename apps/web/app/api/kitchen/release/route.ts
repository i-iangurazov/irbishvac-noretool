import { kitchenIdentity } from "../../../../lib/kitchen-newsletter";
import { kitchenClientVersion } from "../../../../lib/kitchen-client-version";

export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await kitchenIdentity()))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(
    { version: await kitchenClientVersion() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
