import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  authApi: {
    getSession: mocks.getSession,
  },
}));

import { useAuthState } from "./use-auth-state";

describe("useAuthState", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
  });

  it("loads the active session", async () => {
    mocks.getSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        isVerified: false,
      },
      isAuthenticated: true,
      isLoading: false,
    });

    const { result } = renderHook(() => useAuthState());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user?.email).toBe("user@example.com");
  });

  it("falls back to a logged-out snapshot on request failure", async () => {
    mocks.getSession.mockRejectedValue(new Error("session unavailable"));

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});