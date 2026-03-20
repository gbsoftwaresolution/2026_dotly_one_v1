import type { SessionSnapshot } from "@/types/auth";

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
