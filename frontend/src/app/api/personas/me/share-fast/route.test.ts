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

describe("GET /api/personas/me/share-fast", () => {
  it("returns the proxied fast-share payload for the authenticated user", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockResolvedValue({
      selectedPersonaId: "persona-1",
      sharePayload: {
        personaId: "persona-1",
        username: "sender",
        fullName: "Sender Persona",
        profilePhotoUrl: null,
        shareUrl: "https://dotly.one/u/sender",
        qrValue: "https://dotly.one/u/sender",
        primaryAction: null,
        hasQuickConnect: false,
        quickConnectUrl: null,
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.apiRequest).toHaveBeenCalledWith("/personas/me/share-fast", {
      token: "token",
    });
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