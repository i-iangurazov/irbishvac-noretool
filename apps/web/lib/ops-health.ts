import type { HealthPayload } from "../components/ops-pages";

const RAILWAY_API_BASE_URL = "https://irbisapi-production.up.railway.app";

export function getProductionApiBaseUrl() {
  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? RAILWAY_API_BASE_URL;
}

export async function fetchProductionHealth(): Promise<HealthPayload | null> {
  try {
    const response = await fetch(`${getProductionApiBaseUrl()}/api/health/ready`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as HealthPayload;
  } catch {
    return null;
  }
}

