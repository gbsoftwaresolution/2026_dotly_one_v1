import type { NextResponse } from "next/server";

export interface SecurityHeader {
  key: string;
  value: string;
}

const permissionsPolicy = [
  "accelerometer=()",
  "ambient-light-sensor=()",
  "bluetooth=()",
  "geolocation=()",
  "gyroscope=()",
  "hid=()",
  "magnetometer=()",
  "payment=()",
  "serial=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

export function createFrontendContentSecurityPolicy(options?: {
  nodeEnv?: string;
}): string {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  const scriptSrc = ["'self'", "'unsafe-inline'", "https:"];
  const styleSrc = ["'self'", "'unsafe-inline'", "https:"];
  const connectSrc = ["'self'", "https:"];

  if (!isProduction) {
    scriptSrc.push("'unsafe-eval'");
    connectSrc.push("http:", "ws:", "wss:");
  }

  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self' data: https:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob: https:",
    "manifest-src 'self'",
    "media-src 'self' data: blob: https:",
    "object-src 'none'",
    `script-src ${scriptSrc.join(" ")}`,
    `style-src ${styleSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    "worker-src 'self' blob:",
  ];

  if (isProduction) {
    policy.push("upgrade-insecure-requests");
  }

  return policy.join("; ");
}

export function getFrontendSecurityHeaders(options?: {
  nodeEnv?: string;
}): SecurityHeader[] {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const headers: SecurityHeader[] = [
    {
      key: "Content-Security-Policy",
      value: createFrontendContentSecurityPolicy({ nodeEnv }),
    },
    {
      key: "Permissions-Policy",
      value: permissionsPolicy,
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-DNS-Prefetch-Control",
      value: "off",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "X-Permitted-Cross-Domain-Policies",
      value: "none",
    },
  ];

  if (nodeEnv === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  return headers;
}

export function applyFrontendSecurityHeaders(
  response: NextResponse,
  options?: {
    nodeEnv?: string;
  },
): NextResponse {
  for (const header of getFrontendSecurityHeaders(options)) {
    response.headers.set(header.key, header.value);
  }

  return response;
}