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

describe("POST /api/users/me/verification/resend", () => {
  it("returns 401 when there is no authenticated session", async () => {
    mocks.getServerAccessToken.mockResolvedValue(null);

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ message: "Unauthorized" });
  });

  it("proxies the authenticated resend request", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockResolvedValue({
      accepted: true,
      verificationPending: true,
      verificationEmailSent: true,
      mailDeliveryAvailable: true,
    });

    const response = await POST();
    const payload = await response.json();

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "/users/me/verification/resend",
      {
        method: "POST",
        token: "token",
      },
    );
    expect(response.status).toBe(200);
    expect(payload).toEqual({
      accepted: true,
      verificationPending: true,
      verificationEmailSent: true,
      mailDeliveryAvailable: true,
    });
  });
});