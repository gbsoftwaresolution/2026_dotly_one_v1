import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<object>("@/lib/api/client");

  return {
    ...actual,
    apiRequest: mocks.apiRequest,
  };
});

import { POST } from "./route";

describe("POST /api/auth/passkeys/authenticate/options", () => {
  it("proxies the passkey authentication options request", async () => {
    mocks.apiRequest.mockResolvedValue({
      options: { challenge: "challenge" },
    });

    const response = await POST(
      new Request("http://localhost/api/auth/passkeys/authenticate/options", {
        method: "POST",
        body: JSON.stringify({ email: "ava@dotly.one" }),
      }),
    );
    const payload = await response.json();

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "/auth/passkeys/authenticate/options",
      {
        method: "POST",
        body: { email: "ava@dotly.one" },
      },
    );
    expect(response.status).toBe(200);
    expect(payload.options.challenge).toBe("challenge");
  });
});
