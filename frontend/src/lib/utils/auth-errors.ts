import { isApiError } from "@/lib/api/client";

export type AuthErrorKind =
  | "invalid"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "throttled"
  | "unknown";

export type ClassifiedAuthError = {
  kind: AuthErrorKind;
  status?: number;
  message: string;
};

export function classifyAuthError(error: unknown): ClassifiedAuthError {
  if (!isApiError(error)) {
    return {
      kind: "unknown",
      message: "Unexpected authentication error",
    };
  }

  const kind: AuthErrorKind =
    error.status === 400
      ? "invalid"
      : error.status === 401
        ? "unauthorized"
        : error.status === 403
          ? "forbidden"
          : error.status === 404
            ? "not-found"
            : error.status === 409
              ? "conflict"
              : error.status === 429
                ? "throttled"
                : "unknown";

  return {
    kind,
    status: error.status,
    message: error.message,
  };
}

export function isExpiredSessionError(error: unknown): boolean {
  return classifyAuthError(error).kind === "unauthorized";
}

export function isThrottledAuthError(error: unknown): boolean {
  return classifyAuthError(error).kind === "throttled";
}
