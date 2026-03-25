import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../api/vaultKey", () => ({
  vaultKeyApi: {
    getStatus: vi.fn(),
    getBundle: vi.fn(),
    upsert: vi.fn(),
  },
}));

import { vaultKeyApi } from "../api/vaultKey";
import { unlockVault } from "./vaultKey";

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

const mockCrypto = {
  subtle: {
    importKey: vi.fn(),
    exportKey: vi.fn(),
    generateKey: vi.fn(),
    deriveKey: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
  },
  getRandomValues: vi.fn((arr: Uint8Array) => arr),
} satisfies Crypto;

Object.defineProperty(globalThis, "crypto", {
  value: mockCrypto,
  configurable: true,
});

beforeEach(() => {
  // Mock fetch for API calls (if any code paths use it)
  // @ts-expect-error - test-only assignment
  globalThis.fetch = vi.fn();

  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  vi.clearAllMocks();
});

describe("Vault unlock flow", () => {
  test("Unlock fails gracefully when status API fails", async () => {
    vi.mocked(vaultKeyApi.getStatus).mockRejectedValue(
      new Error("Network error"),
    );
    await expect(unlockVault("password")).rejects.toThrow(/network error/i);
  });

  test("Bundle exists → unlock succeeds", async () => {
    const saltB64 = toBase64(new Uint8Array(16).fill(7));
    const encryptedB64 = toBase64(new Uint8Array(32).fill(8));
    const ivB64 = toBase64(new Uint8Array(12).fill(9));

    const mockBundle = {
      encryptedMasterKey: encryptedB64,
      iv: ivB64,
      kdfParams: {
        salt: saltB64,
        iterations: 200000,
        hash: "SHA-256",
      },
    };

    vi.mocked(vaultKeyApi.getStatus).mockResolvedValue({
      enabled: true,
    } as any);
    vi.mocked(vaultKeyApi.getBundle).mockResolvedValue(mockBundle as any);

    // Setup crypto mocks
    (mockCrypto.subtle.importKey as any).mockResolvedValue({});
    (mockCrypto.subtle.deriveKey as any).mockResolvedValue({});
    // unwrapKey decrypts raw key bytes, then importKeyRaw imports to CryptoKey
    (mockCrypto.subtle.decrypt as any).mockResolvedValue(new ArrayBuffer(32));

    const result = await unlockVault("password");
    expect(result).toBe(true);
    expect(vaultKeyApi.getBundle).toHaveBeenCalled();
  });

  test("Bundle missing → creates bundle and unlock succeeds", async () => {
    vi.mocked(vaultKeyApi.getStatus).mockResolvedValue({
      enabled: false,
    } as any);

    // generateVaultMasterKey -> generateKey
    (mockCrypto.subtle.generateKey as any).mockResolvedValue({
      extractable: true,
    });
    // derivePasswordKey -> importKey + deriveKey
    (mockCrypto.subtle.importKey as any).mockResolvedValue({});
    (mockCrypto.subtle.deriveKey as any).mockResolvedValue({});
    // wrapKey -> exportKeyRaw + encrypt
    (mockCrypto.subtle.exportKey as any).mockResolvedValue(new ArrayBuffer(32));
    (mockCrypto.subtle.encrypt as any).mockResolvedValue(new ArrayBuffer(48));

    const result = await unlockVault("password");

    expect(result).toBe(true);
    expect(vaultKeyApi.upsert).toHaveBeenCalled();
  });

  test("Wrong password → shows correct message", async () => {
    const saltB64 = toBase64(new Uint8Array(16).fill(1));
    const encryptedB64 = toBase64(new Uint8Array(32).fill(2));
    const ivB64 = toBase64(new Uint8Array(12).fill(3));

    const mockBundle = {
      encryptedMasterKey: encryptedB64,
      iv: ivB64,
      kdfParams: {
        salt: saltB64,
        iterations: 200000,
        hash: "SHA-256",
      },
    };

    vi.mocked(vaultKeyApi.getStatus).mockResolvedValue({
      enabled: true,
    } as any);
    vi.mocked(vaultKeyApi.getBundle).mockResolvedValue(mockBundle as any);

    (mockCrypto.subtle.importKey as any).mockResolvedValueOnce({}); // base key
    (mockCrypto.subtle.deriveKey as any).mockResolvedValue({});
    (mockCrypto.subtle.decrypt as any).mockRejectedValue(
      new Error("Decryption failed"),
    );

    await expect(unlockVault("wrong-password")).rejects.toThrow(
      "Couldn't unlock the vault with that password.",
    );
  });

  test("KDF params invalid → throws appropriate error", async () => {
    const mockBundle = {
      encryptedMasterKey: toBase64(new Uint8Array(32).fill(2)),
      iv: toBase64(new Uint8Array(12).fill(3)),
      kdfParams: {
        // Missing required fields
      },
    };

    vi.mocked(vaultKeyApi.getStatus).mockResolvedValue({
      enabled: true,
    } as any);
    vi.mocked(vaultKeyApi.getBundle).mockResolvedValue(mockBundle as any);

    await expect(unlockVault("password")).rejects.toThrow(
      "Vault setup data is missing or invalid.",
    );
  });

  test("Diagnostic signals logged in dev mode", async () => {
    if (!import.meta.env.DEV) return;

    const mockBundle = {
      encryptedMasterKey: toBase64(new Uint8Array(32).fill(8)),
      iv: toBase64(new Uint8Array(12).fill(9)),
      kdfParams: {
        salt: toBase64(new Uint8Array(16).fill(7)),
        iterations: 200000,
        hash: "SHA-256",
      },
    };

    vi.mocked(vaultKeyApi.getStatus).mockResolvedValue({
      enabled: true,
    } as any);
    vi.mocked(vaultKeyApi.getBundle).mockResolvedValue(mockBundle as any);

    (mockCrypto.subtle.importKey as any).mockResolvedValue({});
    (mockCrypto.subtle.deriveKey as any).mockResolvedValue({});
    (mockCrypto.subtle.decrypt as any).mockResolvedValue(new ArrayBuffer(32));

    await unlockVault("password");

    const debugSpy = vi.mocked(console.debug);
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining("[VaultUnlock]"),
      expect.anything(),
    );
  });
});

// Manual test checklist helper
export const manualTestChecklist = {
  "1. New user": ["register → login → unlock → upload → view works"],
  "2. Existing user without bundle": [
    "login → unlock triggers bundle creation → old media decrypts",
  ],
  "3. Wrong password": [
    'shows "Couldn\'t unlock…" with proper help text, no misleading errors',
  ],
  "4. Password reset": [
    "login works",
    "unlock uses recovery phrase path (if enabled)",
    "after restore, bundle rewrap for new password happens and subsequent unlock works",
  ],
  "5. Trusted device": [
    "enabled, browser restart still requires password, unlock works",
  ],
  "6. Logout clears": [
    "in-memory master key",
    "any decrypted object URLs",
    "share tokens in memory",
  ],
};
