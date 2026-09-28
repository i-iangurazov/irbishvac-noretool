import { getConfig } from "@irbis/config";
import { ServiceTitanClient } from "./client";

type Resource = "memberships" | "employees" | "technicians" | "business-units";
const paths: Record<Resource, string> = {
  memberships: "memberships",
  employees: "settings",
  technicians: "settings",
  "business-units": "settings",
};

/** Read-only endpoints. Report builders explicitly select fields exposed to the dashboard. */
export class MembershipSourceClient {
  constructor(private readonly client = new ServiceTitanClient()) {}

  async customerTypes(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.some((id) => !/^\d+$/.test(id)))
      throw new Error("Invalid membership customer ID");
    const config = getConfig().serviceTitan,
      token = await this.client.getAccessToken();
    const result = new Map<string, string>();
    for (let start = 0; start < unique.length; start += 50) {
      const batch = unique.slice(start, start + 50),
        allowed = new Set(batch);
      const url = new URL(
        `https://api.servicetitan.io/crm/v2/tenant/${config.tenantId}/customers`,
      );
      url.search = new URLSearchParams({
        ids: batch.join(","),
        active: "Any",
        pageSize: "5000",
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
        if (attempt < 2)
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              Math.min(
                65,
                Math.max(5, Number(response!.headers.get("retry-after")) || 30),
              ) * 1000,
            ),
          );
      }
      if (!response?.ok)
        throw new Error(
          `Customer types unavailable (${response?.status ?? "network"})`,
        );
      const body = (await response.json()) as {
        hasMore?: boolean;
        data?: Array<{ id: number; type: string }>;
      };
      if (
        body.hasMore !== false ||
        !Array.isArray(body.data) ||
        body.data.some((row) => !allowed.has(String(row.id)))
      )
        throw new Error("Customer filter could not be verified");
      for (const row of body.data) result.set(String(row.id), row.type);
      if (batch.some((id) => !result.has(id)))
        throw new Error("Customer classifications incomplete");
    }
    return result;
  }

  async invoiceMembershipCharges(invoiceNumber: string): Promise<number> {
    const config = getConfig().serviceTitan,
      token = await this.client.getAccessToken();
    const url = new URL(
      `https://api.servicetitan.io/accounting/v2/tenant/${config.tenantId}/invoices`,
    );
    url.search = new URLSearchParams({
      number: invoiceNumber,
      pageSize: "100",
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
      if (attempt < 2)
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(
              65,
              Math.max(5, Number(response!.headers.get("retry-after")) || 30),
            ) * 1000,
          ),
        );
    }
    if (!response?.ok)
      throw new Error(
        `Member invoice unavailable (${response?.status ?? "network"})`,
      );
    const body = (await response.json()) as {
      hasMore?: boolean;
      data?: Array<{
        referenceNumber?: string;
        items?: Array<{ membershipTypeId?: number; total?: string }>;
      }>;
    };
    // A filter that was ignored, truncated, or matched ambiguously cannot be used for deductions.
    if (
      body.hasMore !== false ||
      !Array.isArray(body.data) ||
      body.data.length !== 1 ||
      String(body.data[0]?.referenceNumber) !== invoiceNumber ||
      !Array.isArray(body.data[0]?.items)
    )
      throw new Error("Member invoice could not be matched exactly");
    let cents = 0;
    for (const item of body.data[0].items) {
      if (
        item.membershipTypeId == null ||
        !Number.isFinite(Number(item.membershipTypeId))
      )
        throw new Error("Invoice membership classification missing");
      if (Number(item.membershipTypeId) <= 0) continue;
      if (
        item.total == null ||
        item.total === "" ||
        !Number.isFinite(Number(item.total))
      )
        throw new Error("Membership invoice amount missing");
      cents += Math.round(Number(item.total) * 100);
    }
    return cents / 100;
  }

  async statusHistory(): Promise<Record<string, unknown>[]> {
    const config = getConfig().serviceTitan;
    const token = await this.client.getAccessToken();
    const rows: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 100; page++) {
      const url = new URL(
        `https://api.servicetitan.io/memberships/v2/tenant/${config.tenantId}/export/membership-status-changes`,
      );
      if (cursor) url.searchParams.set("from", cursor);
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
        if (attempt < 2)
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              Math.min(
                65,
                Math.max(5, Number(response!.headers.get("retry-after")) || 30),
              ) * 1000,
            ),
          );
      }
      if (!response?.ok)
        throw new Error(
          `Membership history unavailable (${response?.status ?? "network"})`,
        );
      const body = (await response.json()) as {
        data?: Record<string, unknown>[];
        hasMore?: boolean;
        continueFrom?: string;
      };
      if (!Array.isArray(body.data) || typeof body.hasMore !== "boolean")
        throw new Error("Invalid membership history response");
      rows.push(...body.data);
      if (!body.hasMore) return rows;
      if (
        !body.data.length ||
        !body.continueFrom ||
        seen.has(body.continueFrom)
      )
        throw new Error("Incomplete membership history pagination");
      cursor = body.continueFrom;
      seen.add(cursor);
    }
    throw new Error("Membership history exceeded pagination limit");
  }

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
