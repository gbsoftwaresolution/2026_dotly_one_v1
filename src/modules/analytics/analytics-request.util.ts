import { createHash } from "crypto";
import type { Request } from "express";

import {
  getClientIpAddress,
  getHeaderValue,
} from "../../common/utils/request-source.util";

export function buildAnalyticsRequestKey(
  request: Request,
  scope: string,
): string | null {
  const requestId = getHeaderValue(request, "x-idempotency-key");

  if (requestId) {
    return `${scope}:${requestId}`;
  }

  const clientIp = getClientIpAddress(request) || "unknown";
  const userAgent = getHeaderValue(request, "user-agent") ?? "unknown";
  const language = getHeaderValue(request, "accept-language") ?? "unknown";
  const minuteBucket = Math.floor(Date.now() / 60_000);

  return createHash("sha256")
    .update(`${scope}:${clientIp}:${userAgent}:${language}:${minuteBucket}`)
    .digest("hex");
}
