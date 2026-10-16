// Bounded HTTPS helper. Every outbound call in RefPay goes through here.
// - 4 s timeout (hosted budget is 10 s per operation, including startup)
// - redirect: "error"  (redirect chains are not part of the PayBox network contract)
// - never logs headers or bodies (brokered secrets are injected by PayBox as headers)
import { FETCH_TIMEOUT_MS } from "../config.js";

export class UpstreamError extends Error {
  constructor(public readonly host: string, message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

/** Log to stderr only. stdout is reserved for MCP JSON. Keep it short: stderr cap is 16 KiB per operation. */
export function log(msg: string): void {
  process.stderr.write(`[refpay] ${msg.slice(0, 300)}\n`);
}

export async function fetchJson<T = unknown>(
  url: string,
  init: { method?: "GET" | "POST"; body?: unknown; headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<T> {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new UpstreamError(u.hostname, "HTTPS only");
  const headers: Record<string, string> = { Accept: "application/json", ...(init.headers ?? {}) };
  let body: string | undefined;
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  let res: Response;
  try {
    res = await fetch(u, {
      method: init.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(init.timeoutMs ?? FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    throw new UpstreamError(u.hostname, e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network error");
  }
  if (!res.ok) throw new UpstreamError(u.hostname, `HTTP ${res.status}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new UpstreamError(u.hostname, "invalid JSON");
  }
}
