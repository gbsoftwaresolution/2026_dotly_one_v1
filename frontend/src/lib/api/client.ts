import type { ApiRequestOptions, ApiResponse } from "@/types/api";

import { resolveMockApiRequest } from "@/lib/e2e/mock-api";
import { isE2eMockMode } from "@/lib/e2e/mock-mode";

const DEFAULT_API_BASE_URL = "http://localhost:3000/v1";

function isLocalOrPlaceholderHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".example") ||
    normalized.endsWith(".internal")
  );
}

function assertTrustedApiBaseUrl(baseUrl: string): void {
  let parsed: URL;

  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL must be a valid absolute URL in production.",
    );
  }

  if (parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must use HTTPS in production.");
  }

  if (isLocalOrPlaceholderHost(parsed.hostname)) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL must not target localhost or placeholder hosts in production.",
    );
  }
}

export function getApiBaseUrl(): string {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";

  if (!configuredBaseUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_API_BASE_URL must be configured with the trusted HTTPS backend origin in production.",
      );
    }

    return DEFAULT_API_BASE_URL;
  }

  if (process.env.NODE_ENV === "production") {
    assertTrustedApiBaseUrl(configuredBaseUrl);
  }

  return configuredBaseUrl;
}

function resolveApiUrl(path: string, baseUrl?: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  if (baseUrl === "") {
    return path.startsWith("/") ? path : `/${path}`;
  }

  const resolvedBaseUrl = (baseUrl ?? getApiBaseUrl()).replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${resolvedBaseUrl}${normalizedPath}`;
}

function extractMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (Array.isArray(payload) && payload.length > 0) {
    return payload.join(", ");
  }

  if (typeof payload === "object" && payload !== null && "message" in payload) {
    return extractMessage(
      (payload as { message?: string | string[] }).message,
      fallback,
    );
  }

  return fallback;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  requestId?: string;

  constructor(
    message: string,
    status: number,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  if (isE2eMockMode()) {
    const mockResult = resolveMockApiRequest(path, options);

    if (mockResult?.handled) {
      if (mockResult.ok) {
        return mockResult.data as T;
      }

      throw new ApiError(
        mockResult.message,
        mockResult.status,
        mockResult.details,
      );
    }
  }

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(resolveApiUrl(path, options.baseUrl), {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: options.cache || "no-store",
    credentials: options.credentials,
    next: options.next,
    signal: options.signal,
  });

  const rawBody = await response.text();
  let payload: ApiResponse<T> | T | null = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as ApiResponse<T> | T;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const requestIdHeader =
      response.headers && typeof response.headers.get === "function"
        ? (response.headers.get("x-request-id") ?? undefined)
        : undefined;

    throw new ApiError(
      extractMessage(payload, `Request failed with status ${response.status}`),
      response.status,
      payload,
      requestIdHeader,
    );
  }

  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    "data" in payload
  ) {
    return (payload as ApiResponse<T>).data as T;
  }

  return payload as T;
}
