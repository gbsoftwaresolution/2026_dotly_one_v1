"use client";

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
    <p className="text-xs text-muted">
      Signed in as {session.user?.email ?? "your account"}
    </p>
  );
}
