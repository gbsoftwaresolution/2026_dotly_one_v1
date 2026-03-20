import type { ApiRequestOptions, ApiResponse } from "@/types/api";

const DEFAULT_API_BASE_URL = "http://localhost:3000/v1";

function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    DEFAULT_API_BASE_URL
  );
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

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
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
    throw new ApiError(
      extractMessage(payload, `Request failed with status ${response.status}`),
      response.status,
      payload,
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
