import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerAccessToken: vi.fn(),
  clearAuthCookie: vi.fn(),
  me: vi.fn(),
}));

vi.mock("@/lib/auth/server-session", () => ({
  getServerAccessToken: mocks.getServerAccessToken,
  clearAuthCookie: mocks.clearAuthCookie,
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<object>("@/lib/api");

  return {
    ...actual,
    userApi: {
      me: mocks.me,
    },
  };
});

import { ApiError } from "@/lib/api/client";

import { GET } from "./route";

describe("GET /api/auth/session", () => {
  it("returns the current session with verification state", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.me.mockResolvedValue({
      id: "user-1",
      email: "user@dotly.one",
      isVerified: false,
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: "user-1",
        email: "user@dotly.one",
        isVerified: false,
      },
    });
  });

  it("returns a logged out snapshot when there is no access token", async () => {
    mocks.getServerAccessToken.mockResolvedValue(null);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });
  });

  it("clears the cookie and returns logged out on backend 401", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.me.mockRejectedValue(
      new ApiError("Unauthorized", 401, { message: "Unauthorized" }),
    );

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.isAuthenticated).toBe(false);
    expect(mocks.clearAuthCookie).toHaveBeenCalledTimes(1);
  });
});
