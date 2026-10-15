import { setTimeout as delay } from "node:timers/promises";
import { getConfig } from "@irbis/config";
import { toBusinessDateString } from "@irbis/utils";

export type DialpadUser = { id: string; name: string };
type StatsRequest = {
  export_type: "records";
  stat_type: "calls";
  timezone: string;
  is_today?: boolean;
  days_ago_start?: number;
  days_ago_end?: number;
};

/** RFC 4180 records, including quoted commas/newlines and escaped quotes. */
export function parseDialpadCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else value += char;
    } else if (char === '"' && !value && !closed) quoted = true;
    else if (char === "," || char === "\n" || char === "\r") {
      row.push(value);
      value = "";
      closed = false;
      if (char !== ",") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (char === "\r" && text[i + 1] === "\n") i++;
      }
    } else {
      if (closed || char === '"') throw new Error("Malformed Dialpad CSV");
      value += char;
    }
  }
  if (quoted) throw new Error("Truncated Dialpad CSV");
  if (value || row.length || closed) {
    row.push(value);
    rows.push(row);
  }
  const headers = rows.shift()?.map((field) => field.trim());
  if (!headers?.length || new Set(headers).size !== headers.length)
    throw new Error("Invalid Dialpad CSV header");
  for (const field of [
    "call_id",
    "date_started",
    "target_id",
    "name",
    "direction",
    "categories",
    "is_internal",
  ])
    if (!headers.includes(field))
      throw new Error(`Dialpad CSV missing ${field}`);
  if (!headers.includes("target_type") && !headers.includes("target_kind"))
    throw new Error("Dialpad CSV missing target type");
  return rows.map((cells) => {
    if (cells.length !== headers.length)
      throw new Error("Incomplete Dialpad CSV row");
    return Object.fromEntries(
      headers.map((header, index) => [header, cells[index]!]),
    );
  });
}

export function dialpadStatsRequests(
  from: string,
  to: string,
  now: Date,
  timezone: string,
): StatsRequest[] {
  const day = (value: string) => {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
    )
      throw new Error("Invalid Dialpad reporting date");
    return Date.parse(`${value}T00:00:00Z`);
  };
  const today = toBusinessDateString(now, timezone);
  const todayMs = day(today),
    start = day(from),
    end = day(to);
  if (start > end || start > todayMs)
    throw new Error("Invalid Dialpad reporting range");
  const base = {
    export_type: "records",
    stat_type: "calls",
    timezone,
  } as const;
  const requests: StatsRequest[] = [];
  if (start < todayMs)
    requests.push({
      ...base,
      days_ago_start: Math.max(1, Math.round((todayMs - end) / 86_400_000)),
      days_ago_end: Math.round((todayMs - start) / 86_400_000),
    });
  if (end >= todayMs) requests.push({ ...base, is_today: true });
  return requests;
}

/** Only reads users and analytics. POST /stats generates a report, never sends an email. */
export class DialpadClient {
  constructor(private readonly apiKey = getConfig().dialpad.apiKey) {}

  isConfigured() {
    return Boolean(this.apiKey.trim());
  }

  private async api(path: string, body?: StatsRequest): Promise<unknown> {
    if (!this.isConfigured()) throw new Error("Dialpad is not configured");
    const response = await fetch(`https://dialpad.com/api/v2/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(25_000),
      redirect: "error",
    });
    // Never include response bodies, signed URLs, or credentials in errors/logs.
    if (!response.ok)
      throw new Error(`Dialpad request failed (${response.status})`);
    return response.json();
  }

  async listUsers(): Promise<DialpadUser[]> {
    const users: DialpadUser[] = [];
    const seen = new Set<string>();
    let cursor = "";
    for (let page = 0; page < 100; page++) {
      const result = (await this.api(
        `users${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      )) as {
        items?: {
          id?: string | number;
          first_name?: string;
          last_name?: string;
          display_name?: string;
        }[];
        cursor?: string | null;
      };
      if (!Array.isArray(result.items))
        throw new Error("Invalid Dialpad user page");
      for (const user of result.items) {
        const name =
          [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
          user.display_name?.trim();
        if (
          !/^\d+$/.test(String(user.id)) ||
          (typeof user.id === "number" && !Number.isSafeInteger(user.id)) ||
          !name
        )
          throw new Error("Invalid Dialpad user identity");
        users.push({ id: String(user.id), name });
      }
      if (!result.cursor) return users;
      if (seen.has(result.cursor))
        throw new Error("Repeated Dialpad user cursor");
      cursor = result.cursor;
      seen.add(cursor);
    }
    throw new Error("Incomplete Dialpad user directory");
  }

  private async callReport(
    request: StatsRequest,
  ): Promise<Record<string, string>[]> {
    const created = (await this.api("stats", request)) as {
      request_id?: string;
    };
    if (!created.request_id) throw new Error("Missing Dialpad report ID");
    for (let attempt = 0; attempt < 20; attempt++) {
      await delay(attempt === 0 ? 15_000 : 5_000);
      const result = (await this.api(
        `stats/${encodeURIComponent(created.request_id)}`,
      )) as {
        status?: string;
        download_url?: string;
        file_type?: string;
      };
      if (result.status === "processing") continue;
      if (result.status !== "complete" || !result.download_url)
        throw new Error("Dialpad report failed");
      let url = new URL(result.download_url);
      for (let redirect = 0; redirect < 4; redirect++) {
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.port ||
          !(
            url.hostname === "storage.googleapis.com" ||
            url.hostname.endsWith(".storage.googleapis.com") ||
            url.hostname === "dialpad.com" ||
            url.hostname.endsWith(".dialpad.com")
          )
        )
          throw new Error("Unexpected Dialpad report download host");
        // Signed downloads redirect within Dialpad. Validate every hop; never forward the API key.
        const response = await fetch(url, {
          redirect: "manual",
          signal: AbortSignal.timeout(45_000),
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          await response.body?.cancel();
          if (!location) throw new Error("Missing Dialpad report redirect");
          url = new URL(location, url);
          continue;
        }
        if (!response.ok)
          throw new Error(
            `Dialpad report download failed (${response.status})`,
          );
        if (Number(response.headers.get("content-length")) > 100_000_000)
          throw new Error("Dialpad report exceeds size limit");
        const text = await response.text();
        if (text.length > 100_000_000)
          throw new Error("Dialpad report exceeds size limit");
        return parseDialpadCsv(text);
      }
      throw new Error("Too many Dialpad report redirects");
    }
    throw new Error("Dialpad report processing timed out");
  }

  async readCallLogs(
    from: string,
    to: string,
    now = new Date(),
    timezone = "America/Los_Angeles",
  ) {
    const reports = await Promise.all(
      dialpadStatsRequests(from, to, now, timezone).map((request) =>
        this.callReport(request),
      ),
    );
    return reports.flat();
  }
}
