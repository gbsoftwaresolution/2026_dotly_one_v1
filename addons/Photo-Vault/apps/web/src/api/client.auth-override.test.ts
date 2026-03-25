import { beforeEach, describe, expect, test, vi } from "vitest";

import { apiClient, get } from "./client";

describe("ApiClient Authorization header handling", () => {
  beforeEach(() => {
    apiClient.setTokens(null);
    localStorage.clear();

    // @ts-expect-error - test-only assignment
    globalThis.fetch = vi.fn();
  });

  test("does not override an explicit Authorization header (RequestInit)", async () => {
    apiClient.setTokens({
      accessToken: "USER_ACCESS",
      refreshToken: "USER_REFRESH",
    });

    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true }),
    } as any);

    await apiClient.get("/v1/heir/releases", {
      headers: { Authorization: "Bearer HEIR_TOKEN" },
    });

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    const headers = (init as any).headers as Record<string, string>;

    expect(headers.Authorization).toBe("Bearer HEIR_TOKEN");
  });

  test("does not override an explicit Authorization header (raw headers object)", async () => {
    apiClient.setTokens({
      accessToken: "USER_ACCESS",
      refreshToken: "USER_REFRESH",
    });

    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true }),
    } as any);

    await get("/v1/heir/releases", {
      Authorization: "Bearer HEIR_TOKEN",
    });

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    const headers = (init as any).headers as Record<string, string>;

    expect(headers.Authorization).toBe("Bearer HEIR_TOKEN");
  });

  test("respects lowercase authorization header too", async () => {
    apiClient.setTokens({
      accessToken: "USER_ACCESS",
      refreshToken: "USER_REFRESH",
    });

    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true }),
    } as any);

    await apiClient.get("/v1/heir/releases", {
      headers: { authorization: "Bearer HEIR_TOKEN" } as any,
    });

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    const headers = (init as any).headers as Record<string, string>;

    expect(headers.authorization).toBe("Bearer HEIR_TOKEN");
    expect(headers.Authorization).toBeUndefined();
  });
});
