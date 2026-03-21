"use client";

import { useAuthState } from "@/hooks/use-auth-state";

import { VerificationPrompt } from "./verification-prompt";

export function EmailVerificationBanner() {
  const session = useAuthState();

  if (
    session.isLoading ||
    !session.isAuthenticated ||
    !session.user ||
    session.user.isVerified
  ) {
    return null;
  }

  return (
    <VerificationPrompt
      compact
      email={session.user.email}
      title="Verify your email to unlock trust actions"
      description="Dotly keeps login and onboarding open, but connection requests, shareable QR creation, and event discovery stay limited until your email is verified."
    />
  );
}