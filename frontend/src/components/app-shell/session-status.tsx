"use client";

import { VerificationStatusBadge } from "@/components/auth/verification-status-badge";
import { useAuthState } from "@/hooks/use-auth-state";

export function SessionStatus() {
  const session = useAuthState();

  if (session.isLoading) {
    return <p className="text-xs text-muted">Checking session...</p>;
  }

  if (!session.isAuthenticated) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <p>Signed in as {session.user?.email ?? "your account"}</p>
      {session.user ? (
        <VerificationStatusBadge compact isVerified={session.user.isVerified} />
      ) : null}
    </div>
  );
}
