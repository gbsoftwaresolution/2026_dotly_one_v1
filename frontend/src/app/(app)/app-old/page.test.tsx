import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
  userApi: {
    meAnalytics: vi.fn(),
  },
}));

vi.mock("@/lib/auth/protected-route", () => ({
  requireServerSession: mocks.requireServerSession,
}));

vi.mock("@/lib/api/user-api", () => ({
  userApi: mocks.userApi,
}));

import AppHomePage from "./page";

describe("AppHomePage", () => {
  beforeEach(() => {
    mocks.requireServerSession.mockReset();
    mocks.userApi.meAnalytics.mockReset();

    mocks.requireServerSession.mockResolvedValue({
      accessToken: "token",
      user: {
        id: "user-1",
        email: "user@dotly.one",
        isVerified: true,
      },
    });

    mocks.userApi.meAnalytics.mockResolvedValue({
      totalConnections: 10,
      connectionsThisMonth: 2,
    });
  });

  it("loads the dashboard with user analytics", async () => {
    const result = await AppHomePage();

    expect(mocks.requireServerSession).toHaveBeenCalledWith("/app-old");
    expect(mocks.userApi.meAnalytics).toHaveBeenCalledWith("token");
    expect(result).toBeTruthy();
  });
});
