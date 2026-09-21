import { createHash, timingSafeEqual } from "node:crypto";

const requests = new Map<string, { count: number; resetAt: number }>();
const REQUESTS_PER_MINUTE = 60;

export function authorizeCampaignIntegration(request: Request, now = Date.now()) {
  const expected = process.env.CAMPAIGNS_READ_API_KEY_SHA256 ?? "";
  const expiresAt = Date.parse(process.env.CAMPAIGNS_READ_API_KEY_EXPIRES_AT ?? "");
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/i.exec(request.headers.get("authorization") ?? "");
  if (!/^[a-f0-9]{64}$/.test(expected) || !Number.isFinite(expiresAt) || now >= expiresAt || !match) {
    return { authorized: false as const, status: 401, retryAfter: 0 };
  }
  const actual = createHash("sha256").update(match[1]!).digest();
  if (!timingSafeEqual(actual, Buffer.from(expected, "hex"))) {
    return { authorized: false as const, status: 401, retryAfter: 0 };
  }
  // One integration; bounded memory, with a per-instance fixed-window limit.
  for (const [key, bucket] of requests) if (bucket.resetAt <= now) requests.delete(key);
  const bucket = requests.get(expected) ?? { count: 0, resetAt: now + 60_000 };
  requests.set(expected, bucket);
  if (bucket.count >= REQUESTS_PER_MINUTE) {
    return { authorized: false as const, status: 429, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count++;
  return { authorized: true as const, client: "arman", scope: "campaigns:read" as const };
}
