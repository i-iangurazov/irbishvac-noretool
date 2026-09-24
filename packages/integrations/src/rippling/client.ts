const ORIGIN = "https://rest.ripplingapis.com";
type Resource = "workers" | "users" | "departments";

export class RipplingApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number | null = null,
  ) {
    super(`Rippling ${code}${status ? ` (${status})` : ""}`);
    this.name = "RipplingApiError";
  }
}

export class RipplingClient {
  constructor(
    private readonly token: string,
    private readonly version = "2024-08-01",
    private readonly request: typeof fetch = fetch,
    private readonly wait: (milliseconds: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {
    if (!token.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(version))
      throw new RipplingApiError("invalid_configuration");
  }

  private async page(url: URL) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await this.request(url, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Rippling-Api-Version": this.version,
            Accept: "application/json",
          },
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        if (attempt === 2) throw new RipplingApiError("connection_failed");
        await this.wait(1000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < 2
        ) {
          const retryAfter = Number(response.headers.get("retry-after"));
          await response.body?.cancel();
          await this.wait(
            Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter, 60) * 1000
              : 1000 * 2 ** attempt,
          );
          continue;
        }
        await response.body?.cancel();
        throw new RipplingApiError("request_failed", response.status);
      }
      try {
        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== "object" ||
          !Array.isArray((body as { results?: unknown }).results)
        )
          throw new Error();
        const page = body as { results: unknown[]; next_link?: unknown };
        if (
          page.next_link !== undefined &&
          page.next_link !== null &&
          typeof page.next_link !== "string"
        )
          throw new Error();
        if (
          page.results.some(
            (row) =>
              !row ||
              typeof row !== "object" ||
              typeof (row as { id?: unknown }).id !== "string",
          )
        )
          throw new Error();
        return {
          records: page.results,
          next: page.next_link as string | null | undefined,
        };
      } catch {
        throw new RipplingApiError("invalid_response");
      }
    }
    throw new RipplingApiError("request_failed");
  }

  async list(resource: Resource): Promise<unknown[]> {
    let link: string | null | undefined = `${ORIGIN}/${resource}/?limit=100`;
    const seen = new Set<string>();
    const records: unknown[] = [];
    while (link) {
      let url: URL;
      try {
        url = new URL(link, ORIGIN);
      } catch {
        throw new RipplingApiError("invalid_pagination");
      }
      if (
        url.origin !== ORIGIN ||
        url.pathname !== `/${resource}/` ||
        url.username ||
        url.password ||
        seen.has(url.href) ||
        seen.size >= 100
      ) {
        throw new RipplingApiError("invalid_pagination");
      }
      seen.add(url.href);
      const page = await this.page(url);
      records.push(...page.records);
      link = page.next;
    }
    return records;
  }

  async directory() {
    const [workers, users, departments] = await Promise.all([
      this.list("workers"),
      this.list("users"),
      this.list("departments"),
    ]);
    return { workers, users, departments };
  }
}
