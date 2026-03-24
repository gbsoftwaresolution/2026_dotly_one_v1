import { describe, expect, it, vi } from "vitest";

import { NextRequest } from "next/server";

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

describe("POST /api/contacts/[relationshipId]/interactions", () => {
  it("proxies a quick interaction to the backend relationship endpoint", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockResolvedValue({ success: true });

    const response = await POST(
      new NextRequest("http://localhost/api/contacts/relationship-id/interactions", {
        method: "POST",
        body: JSON.stringify({ type: "GREETING" }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ relationshipId: "relationship-id" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "/relationships/relationship-id/interactions",
      {
        method: "POST",
        body: { type: "GREETING" },
        token: "token",
      },
    );
  });

  it("returns 400 when the request body is invalid", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");

    const response = await POST(
      new NextRequest("http://localhost/api/contacts/relationship-id/interactions", {
        method: "POST",
        body: "not-json",
      }),
      {
        params: Promise.resolve({ relationshipId: "relationship-id" }),
      },
    );

    expect(response.status).toBe(400);
  });

  it("clears the auth cookie when the backend returns 401", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockRejectedValue(
      new ApiError("Unauthorized", 401, { message: "Unauthorized" }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/contacts/relationship-id/interactions", {
        method: "POST",
        body: JSON.stringify({ type: "THANK_YOU" }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
      {
        params: Promise.resolve({ relationshipId: "relationship-id" }),
      },
    );

    expect(response.status).toBe(401);
    expect(mocks.clearAuthCookie).toHaveBeenCalledTimes(1);
  });
});