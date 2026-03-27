import {
  buildRuntimeErrorPayload,
  normalizeRuntimeError,
} from "@/lib/observability/runtime-error";
import { writeStructuredObservabilityError } from "@/lib/observability/structured-log";

export async function register(): Promise<void> {
  return Promise.resolve();
}

export async function onRequestError(
  error: Error,
  request: {
    path?: string;
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
  },
  context: {
    routerKind?: string;
    routePath?: string;
    routeType?: string;
    renderSource?: string;
    revalidateReason?: string;
  },
): Promise<void> {
  const payload = buildRuntimeErrorPayload({
    source: "server_request_error",
    error,
    pathname: request.path,
  });

  writeStructuredObservabilityError("Frontend request error observed", {
    request: {
      method: request.method,
      path: request.path,
      headers: request.headers,
    },
    context,
    error: normalizeRuntimeError(error),
    payload,
  });
}
