import { reportClientRuntimeError } from "@/lib/observability/runtime-error";

let registered = false;

export function register() {
  if (registered || typeof window === "undefined") {
    return;
  }

  registered = true;

  window.addEventListener("error", (event) => {
    void reportClientRuntimeError({
      source: "client_window_error",
      error: event.error ?? event.message,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    void reportClientRuntimeError({
      source: "client_unhandled_rejection",
      error: event.reason,
    });
  });
}
