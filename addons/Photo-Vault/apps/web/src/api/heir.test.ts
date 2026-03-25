import { beforeEach, describe, expect, test, vi } from "vitest";

import { apiClient } from "./client";
import { heirApi } from "./heir";

describe("heirApi", () => {
  beforeEach(() => {
    apiClient.setTokens(null);
    localStorage.clear();

    // @ts-expect-error - test-only assignment
    globalThis.fetch = vi.fn();
  });

  test("sends Authorization: Bearer <heir_token> (even if user token exists)", async () => {
    apiClient.setTokens({
      accessToken: "USER_ACCESS",
      refreshToken: "USER_REFRESH",
    });
    localStorage.setItem("heir_token", "HEIR_TOKEN");

    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ releases: [] }),
    } as any);

    await heirApi.getReleases();

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(url)).toContain("/v1/heir/releases");

    const headers = (init as any).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer HEIR_TOKEN");
    expect(headers["x-heir-id"]).toBeUndefined();
  });
});
