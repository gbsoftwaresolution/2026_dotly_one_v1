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

describe("GET /api/personas/[personaId]/share-fast", () => {
  it("returns the proxied fast-share payload for the selected persona", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockResolvedValue({
      personaId: "persona-1",
      username: "sender",
      fullName: "Sender Persona",
      profilePhotoUrl: null,
      shareUrl: "https://dotly.one/u/sender",
      qrValue: "https://dotly.one/u/sender",
      primaryAction: null,
      hasQuickConnect: false,
      quickConnectUrl: null,
    });

    const response = await GET(
      new Request("http://localhost/api/personas/persona-1/share-fast"),
      {
        params: Promise.resolve({ personaId: "persona-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "/personas/persona-1/share-fast",
      {
        token: "token",
      },
    );
  });

  it("returns 401 when the request is unauthenticated", async () => {
    mocks.getServerAccessToken.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/personas/persona-1/share-fast"),
      {
        params: Promise.resolve({ personaId: "persona-1" }),
      },
    );

    expect(response.status).toBe(401);
  });

  it("clears the auth cookie when the backend returns 401", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockRejectedValue(
      new ApiError("Unauthorized", 401, { message: "Unauthorized" }),
    );

    const response = await GET(
      new Request("http://localhost/api/personas/persona-1/share-fast"),
      {
        params: Promise.resolve({ personaId: "persona-1" }),
      },
    );

    expect(response.status).toBe(401);
    expect(mocks.clearAuthCookie).toHaveBeenCalledTimes(1);
  });
});