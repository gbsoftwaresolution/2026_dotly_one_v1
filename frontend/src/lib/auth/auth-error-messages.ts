import { isApiError } from "@/lib/api/client";

export type AuthMode = "login" | "signup";

function getDefaultErrorMessage(mode: AuthMode): string {
  return mode === "login"
    ? "Unable to log in. Please check your details and try again."
    : "Unable to create your account right now. Please try again.";
}

export function getFriendlyAuthErrorMessage(
  mode: AuthMode,
  options: {
    status?: number;
    message?: string | null;
  },
): string {
  const message = options.message?.trim() ?? "";

  if (
    mode === "signup" &&
    (options.status === 409 ||
      /already exists|already registered|email.*taken|email.*in use|user.*exists|duplicate|unique constraint/i.test(
        message,
      ))
  ) {
    return "That email is already registered. Log in instead or use a different email.";
  }

  if (
    mode === "signup" &&
    (options.status === 400 || options.status === 422) &&
    /password|weak|min(?:imum)? length|at least \d+ characters|must contain/i.test(
      message,
    )
  ) {
    return "Choose a stronger password. Use 12+ characters with a mix of letters, numbers, and symbols.";
  }

  if (
    options.status === 429 ||
    /too many requests|too many attempts|rate limit/i.test(message)
  ) {
    return "Too many attempts right now. Wait a moment and try again.";
  }

  if (
    mode === "login" &&
    (options.status === 401 ||
      options.status === 403 ||
      /invalid credentials|unauthorized|incorrect password|user not found|invalid email or password/i.test(
        message,
      ))
  ) {
    return "We couldn't match that email and password. Check your details and try again.";
  }

  if (message && !/^request failed with status \d+/i.test(message)) {
    return message;
  }

  return getDefaultErrorMessage(mode);
}

export function getFriendlyAuthError(mode: AuthMode, error: unknown): string {
  if (isApiError(error)) {
    return getFriendlyAuthErrorMessage(mode, {
      status: error.status,
      message: error.message,
    });
  }

  return getDefaultErrorMessage(mode);
}