export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  message?: string | string[];
  timestamp?: string;
  path?: string;
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  cache?: RequestCache;
  headers?: HeadersInit;
  baseUrl?: string;
  credentials?: RequestCredentials;
  next?: NextFetchRequestConfig;
  signal?: AbortSignal;
}

export interface ApiErrorShape {
  status: number;
  message: string;
  details?: unknown;
}
