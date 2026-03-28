import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerAccessToken: vi.fn(),
  clearAuthCookie: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock("@/lib/auth/server-session", () => ({
  getServerAccessToken: mocks.getServerAccessToken,
  clearAuthCookie: mocks.clearAuthCookie,
}));

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<object>("@/lib/api/client");

  return {
    ...actual,
    apiRequest: mocks.apiRequest,
  };
});

import { ApiError } from "@/lib/api/client";

import { GET } from "./route";

describe("GET /api/users/me", () => {
  it("returns the proxied user profile for the authenticated session", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockResolvedValue({
      id: "user-1",
      email: "user@dotly.one",
      isVerified: true,
      security: {
        trustBadge: "verified",
        maskedEmail: "us**@dotly.one",
        mailDeliveryAvailable: true,
        passwordResetAvailable: true,
        smsDeliveryAvailable: true,
        maskedPhoneNumber: null,
        phoneVerificationStatus: "verified",
        mobileOtpEnrollment: null,
        passkeyCount: 1,
        explanation: "",
        unlockedActions: [],
        restrictedActions: [],
        requirements: [],
        trustFactors: [],
        passkeys: [],
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.apiRequest).toHaveBeenCalledWith("/users/me", {
      token: "token",
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    mocks.getServerAccessToken.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("clears the auth cookie when the backend returns 401", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockRejectedValue(
      new ApiError("Unauthorized", 401, { message: "Unauthorized" }),
    );

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.clearAuthCookie).toHaveBeenCalledTimes(1);
  });
});
