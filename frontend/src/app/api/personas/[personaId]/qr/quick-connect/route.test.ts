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

import { POST } from "./route";

describe("POST /api/personas/[personaId]/qr/quick-connect", () => {
  it("returns 401 when the request is unauthenticated", async () => {
    mocks.getServerAccessToken.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/personas/persona-1/qr/quick-connect", {
        method: "POST",
        body: JSON.stringify({ durationHours: 4 }),
      }),
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

    const response = await POST(
      new Request("http://localhost/api/personas/persona-1/qr/quick-connect", {
        method: "POST",
        body: JSON.stringify({ durationHours: 4 }),
      }),
      {
        params: Promise.resolve({ personaId: "persona-1" }),
      },
    );

    expect(response.status).toBe(401);
    expect(mocks.clearAuthCookie).toHaveBeenCalledTimes(1);
  });
});
