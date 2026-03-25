"use client";

import { VerificationStatusBadge } from "@/components/auth/verification-status-badge";
import { useAuthState } from "@/hooks/use-auth-state";

export function SessionStatus() {
  const session = useAuthState();

  if (session.isLoading) {
    return (
      <p className="text-[12px] font-semibold text-muted">
        Checking session...
      </p>
    );
  }

  if (!session.isAuthenticated) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-muted">
      <p className="truncate max-w-[150px]">
        {session.user?.email ?? "your account"}
      </p>
      {session.user ? (
        <div className="scale-90 origin-left">
          <VerificationStatusBadge
            compact
            isVerified={session.user.isVerified}
          />
        </div>
      ) : null}
    </div>
  );
}
