import { getConfig } from "@irbis/config";
import { ServiceTitanClient } from "./client";

type Resource = "memberships" | "employees" | "technicians" | "business-units";
const paths: Record<Resource, string> = {
  memberships: "memberships",
  employees: "settings",
  technicians: "settings",
  "business-units": "settings",
};

/** Read-only endpoints; customer contact details never leave the worker. */
export class MembershipSourceClient {
  constructor(private readonly client = new ServiceTitanClient()) {}

  async list(resource: Resource): Promise<Record<string, unknown>[]> {
    const config = getConfig().serviceTitan;
    const token = await this.client.getAccessToken();
    const result: Record<string, unknown>[] = [];
    for (let page = 1; page <= 100; page++) {
      const url = new URL(
        `https://api.servicetitan.io/${paths[resource]}/v2/tenant/${config.tenantId}/${resource}`,
      );
      url.search = new URLSearchParams({
        page: String(page),
        pageSize: "5000",
        active: "Any",
        includeTotal: "true",
      }).toString();
      let response: Response | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        response = await fetch(url, {
          headers: {
            "ST-App-Key": config.appKey,
            Authorization: `Bearer ${token}`,
          },
          signal: AbortSignal.timeout(60_000),
        });
        if (response.status !== 429 && response.status < 500) break;
        if (attempt < 2) {
          const retry = Number(response.headers.get("retry-after"));
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(65, Math.max(5, retry || 30)) * 1000),
          );
        }
      }
      if (!response?.ok)
        throw new Error(
          `Membership source ${resource} unavailable (${response?.status ?? "network"})`,
        );
      const body = (await response.json()) as {
        data?: Record<string, unknown>[];
        hasMore?: boolean;
        totalCount?: number;
      };
      if (!Array.isArray(body.data) || typeof body.hasMore !== "boolean")
        throw new Error(`Invalid ${resource} response`);
      result.push(...body.data);
      if (!body.hasMore) {
        if (
          typeof body.totalCount === "number" &&
          result.length !== body.totalCount
        )
          throw new Error(`Incomplete ${resource} response`);
        return result;
      }
      if (!body.data.length)
        throw new Error(`Empty paginated ${resource} response`);
    }
    throw new Error(`Membership source ${resource} exceeded pagination limit`);
  }
}
