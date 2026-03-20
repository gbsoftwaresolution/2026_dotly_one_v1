import { createHash } from "crypto";
import type { Request } from "express";

export function buildAnalyticsRequestKey(
  request: Request,
  scope: string,
): string | null {
  const requestId = getHeaderValue(request, "x-idempotency-key")?.trim();

  if (requestId) {
    return `${scope}:${requestId}`;
  }

  const forwardedFor = getHeaderValue(request, "x-forwarded-for");
  const clientIp =
    forwardedFor?.split(",")[0]?.trim() || request.ip || "unknown";
  const userAgent = getHeaderValue(request, "user-agent") ?? "unknown";
  const language = getHeaderValue(request, "accept-language") ?? "unknown";
  const minuteBucket = Math.floor(Date.now() / 60_000);

  return createHash("sha256")
    .update(`${scope}:${clientIp}:${userAgent}:${language}:${minuteBucket}`)
    .digest("hex");
}

function getHeaderValue(request: Request, headerName: string): string | null {
  const value = request.headers[headerName];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
