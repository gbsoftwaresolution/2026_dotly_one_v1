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

describe("GET /api/users/me/passkeys", () => {
  it("returns 401 without an authenticated session", async () => {
    mocks.getServerAccessToken.mockResolvedValue(null);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ message: "Invalid authentication token" });
  });

  it("proxies the authenticated passkey list request", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockResolvedValue({
      passkeys: [
        {
          id: "pk-1",
          name: "MacBook Touch ID",
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
        },
      ],
    });

    const response = await GET();
    const payload = await response.json();

    expect(mocks.apiRequest).toHaveBeenCalledWith("/users/me/passkeys", {
      token: "token",
    });
    expect(payload.passkeys[0].id).toBe("pk-1");
  });
});
