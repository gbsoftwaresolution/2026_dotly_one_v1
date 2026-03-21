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

import { POST } from "./route";

describe("POST /api/users/me/password/change", () => {
  it("returns 401 when there is no authenticated session", async () => {
    mocks.getServerAccessToken.mockResolvedValue(null);

    const request = new Request("http://localhost/api/users/me/password/change", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: "OldPass123!",
        newPassword: "NewPass123!",
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ message: "Unauthorized" });
  });

  it("proxies the authenticated password change request", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockResolvedValue({
      success: true,
      signedOutSessions: true,
    });

    const request = new Request("http://localhost/api/users/me/password/change", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: "OldPass123!",
        newPassword: "NewPass123!",
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "/users/me/password/change",
      {
        method: "POST",
        body: {
          currentPassword: "OldPass123!",
          newPassword: "NewPass123!",
        },
        token: "token",
      },
    );
    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      signedOutSessions: true,
    });
  });
});