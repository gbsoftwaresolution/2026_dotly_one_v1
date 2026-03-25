export const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.VITE_API_URL ?? "http://127.0.0.1:4000";

export const WEB_BASE_URL =
  process.env.WEB_BASE_URL ?? process.env.WEB_ORIGIN?.split(",")[0] ?? "http://127.0.0.1:3000";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitForApiReady(timeoutMs = 60_000) {
  const start = Date.now();
  let okStreak = 0;
  let lastError: unknown;

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        okStreak++;
        if (okStreak >= 2) return;
      } else {
        okStreak = 0;
        lastError = new Error(`API health not OK: ${res.status}`);
      }
    } catch (e) {
      okStreak = 0;
      lastError = e;
    }

    await sleep(500);
  }

  throw new Error(
    `API not ready after ${timeoutMs}ms: ${String((lastError as any)?.message ?? lastError)}`,
  );
}

export class ApiHttpError extends Error {
  status: number;
  bodyText: string;

  constructor(status: number, bodyText: string) {
    super(`HTTP ${status}: ${bodyText}`);
    this.status = status;
    this.bodyText = bodyText;
  }
}

export async function apiJson<T>(
  path: string,
  opts: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    accessToken?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers ?? {}),
  };

  if (opts.accessToken) {
    headers.Authorization = `Bearer ${opts.accessToken}`;
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiHttpError(res.status, text);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    // Allow callers to handle non-JSON endpoints explicitly.
    return (await res.text()) as any as T;
  }

  return (await res.json()) as T;
}

export function randomEmail(prefix = "pw") {
  const rand = Math.random().toString(16).slice(2);
  return `${prefix}-${Date.now()}-${rand}@example.com`;
}
