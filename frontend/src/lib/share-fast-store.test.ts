import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMyFastShare: vi.fn(),
}));

vi.mock("@/lib/api/persona-api", () => ({
  personaApi: {
    getMyFastShare: mocks.getMyFastShare,
  },
}));

describe("share-fast-store", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getMyFastShare.mockReset();
    window.sessionStorage.clear();
  });

  it("prefetches once and reuses the cached share payload", async () => {
    mocks.getMyFastShare.mockResolvedValue({
      persona: {
        id: "persona-1",
        username: "alice",
        fullName: "Alice Demo",
        profilePhotoUrl: null,
      },
      share: {
        shareUrl: "https://dotly.one/u/alice",
        qrValue: "https://dotly.one/u/alice",
        primaryAction: "request_access",
        effectiveActions: {
          canCall: false,
          canWhatsapp: false,
          canEmail: false,
          canSaveContact: false,
        },
        preferredShareType: "smart_card",
      },
    });

    const store = await import("./share-fast-store");

    await store.prefetchMyFastShare();
    await store.prefetchMyFastShare();

    expect(mocks.getMyFastShare).toHaveBeenCalledTimes(1);
    expect(store.getShareFastSnapshot()).toMatchObject({
      status: "ready",
      selectedPersonaId: "persona-1",
      sharePayload: {
        personaId: "persona-1",
        qrValue: "https://dotly.one/u/alice",
      },
    });
    expect(store.getPersonaFastShare("persona-1")).toMatchObject({
      personaId: "persona-1",
      username: "alice",
    });
  });

  it("restores persisted share payloads after a fresh module load", async () => {
    const firstStore = await import("./share-fast-store");

    firstStore.seedMyFastShare({
      persona: {
        id: "persona-2",
        username: "naveen",
        fullName: "Naveen P",
        profilePhotoUrl: null,
      },
      share: {
        shareUrl: "https://dotly.one/q/quick-share-2",
        qrValue: "https://dotly.one/q/quick-share-2",
        primaryAction: "instant_connect",
        effectiveActions: {
          canCall: false,
          canWhatsapp: false,
          canEmail: false,
          canSaveContact: true,
        },
        preferredShareType: "instant_connect",
      },
    });

    vi.resetModules();

    const nextStore = await import("./share-fast-store");
    nextStore.hydrateShareFastStore();

    expect(nextStore.getShareFastSnapshot()).toMatchObject({
      status: "ready",
      selectedPersonaId: "persona-2",
      sharePayload: {
        personaId: "persona-2",
        quickConnectUrl: "https://dotly.one/q/quick-share-2",
      },
    });
    expect(nextStore.getPersonaFastShare("persona-2")).toMatchObject({
      username: "naveen",
      hasQuickConnect: true,
    });
  });
});