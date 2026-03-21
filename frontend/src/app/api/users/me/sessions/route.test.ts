import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerAccessToken: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock("@/lib/auth/server-session", () => ({
  getServerAccessToken: mocks.getServerAccessToken,
}));

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<object>("@/lib/api/client");

  return {
    ...actual,
    apiRequest: mocks.apiRequest,
  };
});

import { GET } from "./route";

describe("GET /api/users/me/sessions", () => {
  it("returns 401 when there is no authenticated session", async () => {
    mocks.getServerAccessToken.mockResolvedValue(null);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ message: "Unauthorized" });
  });

  it("proxies the authenticated session list request", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockResolvedValue({
      sessions: [
        {
          id: "session-1",
          deviceLabel: "MacBook Pro · Chrome",
          platformLabel: "macOS",
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          isCurrent: true,
        },
      ],
    });

    const response = await GET();
    const payload = await response.json();

    expect(mocks.apiRequest).toHaveBeenCalledWith("/users/me/sessions", {
      token: "token",
    });
    expect(response.status).toBe(200);
    expect(payload.sessions).toHaveLength(1);
    expect(payload.sessions[0].id).toBe("session-1");
  });
});