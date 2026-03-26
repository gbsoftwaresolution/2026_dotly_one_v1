import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  getServerAccessToken: vi.fn(),
  clearAuthCookie: vi.fn(),
  createRouteErrorResponse: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiRequest: mocks.apiRequest,
}));

vi.mock("@/lib/auth/server-session", () => ({
  getServerAccessToken: mocks.getServerAccessToken,
  clearAuthCookie: mocks.clearAuthCookie,
}));

vi.mock("@/lib/api/route-error", () => ({
  createRouteErrorResponse: mocks.createRouteErrorResponse,
}));

import { GET } from "./route";

describe("GET /api/identities", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.getServerAccessToken.mockReset();
    mocks.clearAuthCookie.mockReset();
    mocks.createRouteErrorResponse.mockReset();
  });

  it("returns the authenticated user's identities", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockResolvedValue([
      {
        id: "identity-1",
        personId: "user-84",
        identityType: "personal",
        displayName: "Grandpa Joe",
        handle: "grandpa-joe",
        verificationLevel: "basic_verified",
        status: "active",
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body[0].displayName).toBe("Grandpa Joe");
    expect(mocks.apiRequest).toHaveBeenCalledWith("/identities", {
      token: "token",
    });
  });
});
