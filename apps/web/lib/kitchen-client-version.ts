import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Deployment identity only: no credentials or infrastructure details. */
export async function kitchenClientVersion(): Promise<string | null> {
  const revision = process.env.RAILWAY_GIT_COMMIT_SHA;
  if (revision && /^[a-f0-9]{40}$/i.test(revision)) return revision;
  try {
    const id = (
      await readFile(join(process.cwd(), ".next/BUILD_ID"), "utf8")
    ).trim();
    return /^[a-zA-Z0-9_-]{1,128}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
