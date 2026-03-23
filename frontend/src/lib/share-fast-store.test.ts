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
      selectedPersonaId: "persona-1",
      sharePayload: {
        personaId: "persona-1",
        username: "alice",
        fullName: "Alice Demo",
        profilePhotoUrl: null,
        shareUrl: "https://dotly.one/u/alice",
        qrValue: "https://dotly.one/u/alice",
        primaryAction: null,
        hasQuickConnect: false,
        quickConnectUrl: null,
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
      selectedPersonaId: "persona-2",
      sharePayload: {
        personaId: "persona-2",
        username: "naveen",
        fullName: "Naveen P",
        profilePhotoUrl: null,
        shareUrl: "https://dotly.one/u/naveen",
        qrValue: "https://dotly.one/u/naveen",
        primaryAction: "instant_connect",
        hasQuickConnect: true,
        quickConnectUrl: "https://dotly.one/q/quick-share-2",
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