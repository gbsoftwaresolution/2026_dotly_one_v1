"use client";

import { useAuthState } from "@/hooks/use-auth-state";

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
    return (
      <VerificationPrompt
        email={session.user.email}
        title="Verification status"
        description="Your account can still sign in and finish setup, but trust-sensitive networking features stay locked until you verify this email address."
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
              Trust-sensitive actions are unlocked for this account.
            </p>
          </div>
          <VerificationStatusBadge isVerified />
        </div>
      </div>
    </div>
  );
}