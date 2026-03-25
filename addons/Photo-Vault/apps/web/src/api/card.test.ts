import { beforeEach, describe, expect, test, vi } from "vitest";

import { apiClient } from "./client";
import { cardApi } from "./card";

describe("cardApi", () => {
  beforeEach(() => {
    apiClient.setTokens(null);

    // @ts-expect-error - test-only assignment
    globalThis.fetch = vi.fn();
  });

  test("getPublicMode calls GET /v1/card/public/:publicId/modes/:modeSlug", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ mode: { name: "Personal" }, attachments: [] }),
    } as any);

    await cardApi.getPublicMode("PUB_ID", "personal");

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(
      "http://localhost:4000/v1/card/public/PUB_ID/modes/personal",
    );
    expect((init as RequestInit).method).toBe("GET");
  });

  test("createContactRequest calls POST + sends JSON body", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ request: { requestId: "REQ", status: "PENDING" } }),
    } as any);

    await cardApi.createContactRequest("PUB_ID", "personal", {
      requesterName: "Alice",
      requesterEmail: "a@example.com",
      requesterPhone: "+1",
      message: "Hi",
      captchaToken: "cap",
    });

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(
      "http://localhost:4000/v1/card/public/PUB_ID/modes/personal/contact-requests",
    );
    expect((init as RequestInit).method).toBe("POST");

    const headers = (init as any).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");

    expect((init as RequestInit).body).toBe(
      JSON.stringify({
        requesterName: "Alice",
        requesterEmail: "a@example.com",
        requesterPhone: "+1",
        message: "Hi",
        captchaToken: "cap",
      }),
    );
  });

  test("revealContact calls GET + includes X-Card-Token header", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ contact: { email: "a@example.com" } }),
    } as any);

    await cardApi.revealContact("PUB_ID", "personal", "TOKEN_123");

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(
      "http://localhost:4000/v1/card/public/PUB_ID/modes/personal/contact",
    );
    expect((init as RequestInit).method).toBe("GET");

    const headers = (init as any).headers as Record<string, string>;
    expect(headers["X-Card-Token"]).toBe("TOKEN_123");
  });

  test("downloadVCard uses raw fetch and returns blob", async () => {
    const blob = new Blob(["BEGIN:VCARD\nEND:VCARD\n"], { type: "text/vcard" });

    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => blob,
    } as any);

    const res = await cardApi.downloadVCard("PUB ID", "personal", "TOKEN 123");
    expect(res).toBe(blob);

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(
      "http://localhost:4000/v1/card/vcard?publicId=PUB%20ID&modeSlug=personal",
    );

    const headers = (init as any).headers as Record<string, string>;
    expect(headers["X-Card-Token"]).toBe("TOKEN 123");
  });

  test("downloadVCard throws with response text when non-OK", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    } as any);

    await expect(
      cardApi.downloadVCard("PUB_ID", "personal", "TOKEN"),
    ).rejects.toThrow("Forbidden");
  });
});
