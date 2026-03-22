"use client";

import { useAuthState } from "@/hooks/use-auth-state";
import { hasAnyUnlockedTrustRequirement } from "@/lib/auth/trust-requirements";

import { VerificationPrompt } from "./verification-prompt";

export function EmailVerificationBanner() {
  const session = useAuthState();

  if (
    session.isLoading ||
    !session.isAuthenticated ||
    !session.user ||
    hasAnyUnlockedTrustRequirement(session.user)
  ) {
    return null;
  }

  return (
    <VerificationPrompt
      compact
      email={session.user.email}
      title="Add a trust factor to unlock trust actions"
      description="Verify your identity to unlock trusted connection requests, QR sharing, and event discovery."
    />
  );
}