import { isApiError } from "@/lib/api/client";

export function getPasskeyErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "name" in error) {
    const name = String((error as { name?: unknown }).name ?? "");

    if (name === "NotAllowedError") {
      return "Passkey request was canceled or timed out. Try again when you're ready.";
    }

    if (name === "InvalidStateError") {
      return "That passkey is already enrolled on this account.";
    }

    if (name === "NotSupportedError") {
      return "This browser or device does not support passkeys for Dotly yet.";
    }

    if (name === "SecurityError") {
      return "Passkeys need a secure browser context to continue.";
    }
  }

  if (isApiError(error)) {
    return error.message;
  }

  return "Passkeys are unavailable right now. Please try again.";
}

export function browserSupportsPasskeys(): boolean {
  return (
    typeof window !== "undefined" && typeof PublicKeyCredential !== "undefined"
  );
}
