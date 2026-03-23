import { Socket } from "node:net";
import { connect as connectTls } from "node:tls";

export type RedisConnectionSettings = {
  host: string;
  port: number;
  maxRetriesPerRequest: null;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
};

function shouldUseRedisTls(url: URL) {
  return url.protocol === "rediss:" || url.hostname.endsWith(".upstash.io");
}

export function getRedisConnectionSettings(urlString: string): RedisConnectionSettings {
  const url = new URL(urlString);
  const dbSegment = url.pathname.replace("/", "");
  const parsedDb = dbSegment ? Number(dbSegment) : undefined;
  const settings: RedisConnectionSettings = {
    host: url.hostname,
    port: Number(url.port || "6379"),
    maxRetriesPerRequest: null
  };

  if (url.username) {
    settings.username = decodeURIComponent(url.username);
  }

  if (url.password) {
    settings.password = decodeURIComponent(url.password);
  }

  if (dbSegment && Number.isFinite(parsedDb)) {
    settings.db = Number(parsedDb);
  }

  if (shouldUseRedisTls(url)) {
    settings.tls = {};
  }

  return settings;
}

export async function checkRedisConnection(urlString: string, timeoutMs = 1_000) {
  const url = new URL(urlString);
  const port = Number(url.port || "6379");
  const useTls = shouldUseRedisTls(url);

  return new Promise<{ ok: boolean; detail?: string }>((resolve) => {
    const socket = useTls
      ? connectTls({
          host: url.hostname,
          port,
          servername: url.hostname
        })
      : new Socket();
    let settled = false;

    const finish = (status: { ok: boolean; detail?: string }) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(status);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish({ ok: true }));
    socket.once("secureConnect", () => finish({ ok: true }));
    socket.once("timeout", () => finish({ ok: false, detail: "Timed out connecting to Redis" }));
    socket.once("error", (error) => finish({ ok: false, detail: error.message }));

    if (!useTls && socket instanceof Socket) {
      socket.connect(port, url.hostname);
    }
  });
}
