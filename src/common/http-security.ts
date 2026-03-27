import type { NextFunction, Request, Response } from "express";

const API_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const PERMISSIONS_POLICY = [
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

export function getApiContentSecurityPolicy(): string {
  return API_CONTENT_SECURITY_POLICY;
}

export function getPermissionsPolicy(): string {
  return PERMISSIONS_POLICY;
}

export function applyHttpSecurityHeaders(
  response: Pick<Response, "setHeader">,
  options: {
    nodeEnv?: string;
  } = {},
): void {
  response.setHeader("content-security-policy", getApiContentSecurityPolicy());
  response.setHeader("permissions-policy", getPermissionsPolicy());
  response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("x-dns-prefetch-control", "off");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("x-permitted-cross-domain-policies", "none");

  if (options.nodeEnv === "production") {
    response.setHeader(
      "strict-transport-security",
      "max-age=31536000; includeSubDomains",
    );
  }
}

export function createHttpSecurityHeadersMiddleware(options: {
  nodeEnv?: string;
}) {
  return (_request: Request, response: Response, next: NextFunction) => {
    applyHttpSecurityHeaders(response, options);
    next();
  };
}