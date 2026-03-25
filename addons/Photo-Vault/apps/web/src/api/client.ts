import type { ApiErrorResponse } from "../types/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: ApiErrorResponse,
    message?: string,
  ) {
    super(message || data.message || `API Error: ${status}`);
    this.name = "ApiError";
  }
}

export class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  private notifyAuthInvalidated(
    reason: "refresh_failed" | "unauthorized" | "no_refresh_token",
  ) {
    if (typeof window === "undefined") return;
    try {
      window.dispatchEvent(
        new CustomEvent("booster-auth-invalidated", {
          detail: {
            reason,
            at: Date.now(),
          },
        }),
      );
    } catch {
      // ignore
    }
  }

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || this.getApiUrl();
  }

  private getApiUrl(): string {
    // Check for VITE_API_URL in environment
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_API_URL
    ) {
      return import.meta.env.VITE_API_URL;
    }
    return "http://localhost:4000";
  }

  setTokens(tokens: { accessToken: string; refreshToken: string } | null) {
    if (tokens) {
      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
    } else {
      this.accessToken = null;
      this.refreshToken = null;
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAuth = false,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const hasExplicitAuthHeader =
      typeof (headers as any)["Authorization"] === "string" ||
      typeof (headers as any)["authorization"] === "string";

    if (!skipAuth && this.accessToken && !hasExplicitAuthHeader) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Some endpoints return 204 No Content (e.g. revoke, bundle upload).
    // Avoid attempting to parse JSON in those cases.
    let data: any = null;
    if (response.status !== 204) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await response.json().catch(() => null);
      } else {
        data = await response.text().catch(() => null);
      }
    }

    if (!response.ok) {
      // Handle 401 Unauthorized (try refresh token once)
      if (response.status === 401 && this.refreshToken && !skipAuth) {
        try {
          await this.refreshAccessToken();
          // Retry the original request with new token
          return this.request(endpoint, options, skipAuth);
        } catch (refreshError) {
          const refreshStatus =
            refreshError instanceof ApiError ? refreshError.status : undefined;

          // If refresh token is invalid/expired, force a clean logout.
          if (refreshStatus === 401 || refreshStatus === 403) {
            this.setTokens(null);
            this.notifyAuthInvalidated("refresh_failed");
            throw new ApiError(
              response.status,
              data || { statusCode: response.status, message: "Unauthorized" },
            );
          }

          // Transient refresh failure (network/server). Don't wipe tokens/vault; surface the refresh error.
          throw refreshError;
        }
      }

      if (response.status === 401 && !skipAuth) {
        // No refresh token available; tell the app to logout.
        this.notifyAuthInvalidated(
          this.refreshToken ? "unauthorized" : "no_refresh_token",
        );
      }

      throw new ApiError(
        response.status,
        data && typeof data === "object"
          ? data
          : {
              statusCode: response.status,
              message:
                typeof data === "string" && data.trim().length > 0
                  ? data
                  : response.statusText,
            },
      );
    }

    // Successful 204 response
    if (response.status === 204) {
      return undefined as T;
    }

    return data as T;
  }

  async refreshAccessToken(): Promise<string> {
    // Prevent multiple refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    if (!this.refreshToken) {
      this.notifyAuthInvalidated("no_refresh_token");
      throw new Error("No refresh token available");
    }

    this.refreshPromise = (async () => {
      try {
        const data = await this.request<{
          accessToken: string;
          expiresIn: number;
        }>(
          "/v1/auth/refresh",
          {
            method: "POST",
            body: JSON.stringify({ refreshToken: this.refreshToken }),
          },
          true, // skip auth for refresh endpoint
        );

        this.accessToken = data.accessToken;
        return data.accessToken;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // Convenience methods
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(
    endpoint: string,
    body?: any,
    options?: RequestInit,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    body?: any,
    options?: RequestInit,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(
    endpoint: string,
    body?: any,
    options?: RequestInit,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

// Singleton instance
export const apiClient = new ApiClient();

type HeadersLike = Record<string, string>;
type HeadersOrOptions = RequestInit | HeadersLike;

function normalizeOptions(options?: HeadersOrOptions): RequestInit | undefined {
  if (!options) return undefined;

  // If it already looks like RequestInit (has any of these keys), trust it.
  const maybe = options as RequestInit;
  if (
    "headers" in (maybe as any) ||
    "method" in (maybe as any) ||
    "body" in (maybe as any) ||
    "signal" in (maybe as any) ||
    "credentials" in (maybe as any)
  ) {
    return maybe;
  }

  // Otherwise treat it as a raw headers object (common in older call sites).
  return { headers: options as HeadersLike };
}

export function get<T>(
  endpoint: string,
  options?: HeadersOrOptions,
): Promise<T> {
  return apiClient.get<T>(endpoint, normalizeOptions(options));
}

export function post<T>(
  endpoint: string,
  body?: any,
  options?: HeadersOrOptions,
): Promise<T> {
  return apiClient.post<T>(endpoint, body, normalizeOptions(options));
}

export function put<T>(
  endpoint: string,
  body?: any,
  options?: HeadersOrOptions,
): Promise<T> {
  return apiClient.put<T>(endpoint, body, normalizeOptions(options));
}

export function patch<T>(
  endpoint: string,
  body?: any,
  options?: HeadersOrOptions,
): Promise<T> {
  return apiClient.patch<T>(endpoint, body, normalizeOptions(options));
}

export function del<T>(
  endpoint: string,
  options?: HeadersOrOptions,
): Promise<T> {
  return apiClient.delete<T>(endpoint, normalizeOptions(options));
}
