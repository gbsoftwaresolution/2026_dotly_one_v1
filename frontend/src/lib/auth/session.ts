import type { SessionSnapshot } from "@/types/auth";
import type { UserProfile } from "@/types/user";

export function createLoggedOutSessionSnapshot(): SessionSnapshot {
  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
  };
}

export function createLoadingSessionSnapshot(): SessionSnapshot {
  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,
  };
}

export function createAuthenticatedSessionSnapshot(
  user: UserProfile,
): SessionSnapshot {
  return {
    user,
    isAuthenticated: true,
    isLoading: false,
  };
}
