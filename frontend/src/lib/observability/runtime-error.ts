const MAX_TEXT_LENGTH = 4_000;

export type RuntimeErrorSource =
  | "client_error_boundary"
  | "client_window_error"
  | "client_unhandled_rejection"
  | "server_request_error";

export interface RuntimeErrorPayload {
  source: RuntimeErrorSource;
  referenceId?: string;
  pathname?: string;
  href?: string;
  userAgent?: string;
  digest?: string;
  componentStack?: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
}

const reportedErrors = new WeakSet<Error>();

function truncate(value: string, maxLength = MAX_TEXT_LENGTH): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

export function createErrorReferenceId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeRuntimeError(
  error: unknown,
): RuntimeErrorPayload["error"] {
  if (error instanceof Error) {
    return {
      name: truncate(error.name || "Error", 120),
      message: truncate(error.message || "Unexpected error", 1_000),
      ...(error.stack ? { stack: truncate(error.stack) } : {}),
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: truncate(error, 1_000),
    };
  }

  return {
    name: "UnknownError",
    message: "Unexpected non-error rejection",
  };
}

export function shouldReportRuntimeError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return true;
  }

  if (reportedErrors.has(error)) {
    return false;
  }

  reportedErrors.add(error);
  return true;
}

export function buildRuntimeErrorPayload(input: {
  source: RuntimeErrorSource;
  error: unknown;
  referenceId?: string;
  pathname?: string;
  href?: string;
  userAgent?: string;
  digest?: string;
  componentStack?: string;
}): RuntimeErrorPayload {
  return {
    source: input.source,
    ...(input.referenceId
      ? { referenceId: truncate(input.referenceId, 200) }
      : {}),
    ...(input.pathname ? { pathname: truncate(input.pathname, 512) } : {}),
    ...(input.href ? { href: truncate(input.href, 1_024) } : {}),
    ...(input.userAgent ? { userAgent: truncate(input.userAgent, 512) } : {}),
    ...(input.digest ? { digest: truncate(input.digest, 200) } : {}),
    ...(input.componentStack
      ? { componentStack: truncate(input.componentStack) }
      : {}),
    error: normalizeRuntimeError(input.error),
  };
}

export async function reportClientRuntimeError(input: {
  source: Extract<RuntimeErrorSource, `client_${string}`>;
  error: unknown;
  referenceId?: string;
  digest?: string;
  componentStack?: string;
}): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (!shouldReportRuntimeError(input.error)) {
    return;
  }

  const payload = buildRuntimeErrorPayload({
    ...input,
    pathname: window.location.pathname,
    href: window.location.href,
    userAgent: window.navigator.userAgent,
  });
  const body = JSON.stringify(payload);

  try {
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });

      if (navigator.sendBeacon("/api/observability/client-errors", blob)) {
        return;
      }
    }

    await fetch("/api/observability/client-errors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      keepalive: true,
      credentials: "same-origin",
    });
  } catch (reportingError) {
    console.error("Failed to report client runtime error", reportingError);
  }
}
