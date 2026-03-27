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

describe("POST /api/public/[username]/instant-connect", () => {
  it("returns 401 with server timing when the request is unauthenticated", async () => {
    mocks.getServerAccessToken.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/public/alice/instant-connect", {
        method: "POST",
        body: JSON.stringify({ fromPersonaId: "persona-1" }),
      }),
      {
        params: Promise.resolve({ username: "alice" }),
      },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("server-timing")).toMatch(
      /^public-instant-connect;dur=\d+(?:\.\d{2})?$/,
    );
  });

  it("calls the public-identifier backend endpoint and returns server timing", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockResolvedValue({
      relationshipId: "rel-1",
      relationshipState: "approved",
      targetPersonaId: "persona-2",
      targetDisplayName: "Alice",
      targetUsername: "alice",
      connectedAt: "2026-03-23T00:00:00.000Z",
    });

    const response = await POST(
      new Request("http://localhost/api/public/alice/instant-connect", {
        method: "POST",
        body: JSON.stringify({ fromPersonaId: "persona-1" }),
      }),
      {
        params: Promise.resolve({ username: "alice" }),
      },
    );

    expect(response.status).toBe(201);
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "/relationships/instant-connect/by-public-identifier/alice",
      {
        method: "POST",
        body: {
          fromPersonaId: "persona-1",
          source: "profile",
        },
        token: "token",
      },
    );
    expect(response.headers.get("server-timing")).toMatch(
      /^public-instant-connect;dur=\d+(?:\.\d{2})?$/,
    );
  });

  it("clears the auth cookie and preserves server timing when the backend returns 401", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");
    mocks.apiRequest.mockRejectedValue(
      new ApiError("Unauthorized", 401, { message: "Unauthorized" }),
    );

    const response = await POST(
      new Request("http://localhost/api/public/alice/instant-connect", {
        method: "POST",
        body: JSON.stringify({ fromPersonaId: "persona-1" }),
      }),
      {
        params: Promise.resolve({ username: "alice" }),
      },
    );

    expect(response.status).toBe(401);
    expect(mocks.clearAuthCookie).toHaveBeenCalledTimes(1);
    expect(response.headers.get("server-timing")).toMatch(
      /^public-instant-connect;dur=\d+(?:\.\d{2})?$/,
    );
  });

  it("returns 400 when fromPersonaId is missing", async () => {
    mocks.getServerAccessToken.mockResolvedValue("token");

    const response = await POST(
      new Request("http://localhost/api/public/alice/instant-connect", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      {
        params: Promise.resolve({ username: "alice" }),
      },
    );

    expect(response.status).toBe(400);
    expect(mocks.apiRequest).not.toHaveBeenCalled();
    expect(response.headers.get("server-timing")).toMatch(
      /^public-instant-connect;dur=\d+(?:\.\d{2})?$/,
    );
  });
});