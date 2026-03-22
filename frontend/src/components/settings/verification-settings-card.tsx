"use client";

import { useAuthState } from "@/hooks/use-auth-state";
import { hasAnyUnlockedTrustRequirement } from "@/lib/auth/trust-requirements";

import { VerificationPrompt } from "../auth/verification-prompt";
import { VerificationStatusBadge } from "../auth/verification-status-badge";

export function VerificationSettingsCard() {
  const session = useAuthState();

  if (session.isLoading || !session.isAuthenticated || !session.user) {
    return (
      <div className="glass rounded-3xl border border-border bg-surface p-5">
        <div className="h-16 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  if (!session.user.isVerified) {
    if (!hasAnyUnlockedTrustRequirement(session.user)) {
      return (
        <VerificationPrompt
          email={session.user.email}
          title="Verification status"
          description="Your account can still sign in and finish setup, but current trust-sensitive networking features stay locked until you verify your email or complete mobile OTP."
        />
      );
    }

    return (
      <div className="glass rounded-3xl border border-border bg-surface p-5">
        <div className="space-y-3">
          <p className="label-xs text-muted">Verification status</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {session.user.email}
              </p>
              <p className="text-sm text-muted">
                Trust-sensitive actions are already unlocked through another
                verified trust factor. Email verification is still available
                here as an additional signal.
              </p>
            </div>
            <VerificationStatusBadge isVerified={false} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl border border-border bg-surface p-5">
      <div className="space-y-3">
        <p className="label-xs text-muted">Verification status</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {session.user.email}
            </p>
            <p className="text-sm text-muted">
              Trust-sensitive actions are unlocked for this account.
            </p>
          </div>
          <VerificationStatusBadge isVerified />
        </div>
      </div>
    </div>
  );
}