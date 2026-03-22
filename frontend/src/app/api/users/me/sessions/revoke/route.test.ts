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

describe("POST /api/users/me/sessions/revoke", () => {
  it("returns 401 when there is no authenticated session", async () => {
    mocks.getServerAccessToken.mockResolvedValue(null);

    const request = new Request("http://localhost/api/users/me/sessions/revoke", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-2" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ message: "Invalid authentication token" });
  });

  it("proxies the authenticated revoke request", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockResolvedValue({ success: true });

    const request = new Request("http://localhost/api/users/me/sessions/revoke", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-2" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "/users/me/sessions/revoke",
      {
        method: "POST",
        body: {
          sessionId: "session-2",
        },
        token: "token",
      },
    );
    expect(response.status).toBe(200);
    expect(payload).toEqual({ success: true });
  });
});