import { describe, expect, test } from "vitest";

import {
  buildVaultMediaAadBytes,
  buildVaultMediaAadString,
  resolveVaultMediaAadBytesForV2Decrypt,
} from "./aad";
import { decryptData, encryptData } from "./webcrypto";

describe("vault media AAD", () => {
  test("buildVaultMediaAadString is deterministic", () => {
    const a = buildVaultMediaAadString({
      v: 2,
      userId: "user-1",
      mediaId: "media-1",
      variant: "original",
    });
    const b = buildVaultMediaAadString({
      v: 2,
      userId: "user-1",
      mediaId: "media-1",
      variant: "original",
    });

    expect(a).toBe(b);
    expect(a).toContain("booster:vault-media");
    expect(a).toContain("v=2");
    expect(a).toContain("userId=user-1");
    expect(a).toContain("mediaId=media-1");
    expect(a).toContain("variant=original");
  });

  test("AES-GCM decrypt fails when AAD mismatches", async () => {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );

    const plaintext = new TextEncoder().encode("hello world").buffer;

    const aad = buildVaultMediaAadBytes({
      v: 2,
      userId: "user-1",
      mediaId: "media-1",
      variant: "original",
    });

    const { ciphertext, iv } = await encryptData(
      plaintext,
      key,
      undefined,
      aad,
    );

    // Correct AAD works.
    const roundTrip = await decryptData(ciphertext, key, iv, aad);
    expect(new TextDecoder().decode(roundTrip)).toBe("hello world");

    // Wrong AAD fails auth.
    const wrongAad = buildVaultMediaAadBytes({
      v: 2,
      userId: "user-1",
      mediaId: "media-2",
      variant: "original",
    });

    await expect(
      decryptData(ciphertext, key, iv, wrongAad),
    ).rejects.toBeTruthy();

    // Missing AAD also fails auth.
    await expect(decryptData(ciphertext, key, iv)).rejects.toBeTruthy();
  });

  test("v1 (no AAD) round-trip still decrypts", async () => {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );

    const plaintext = new TextEncoder().encode("legacy").buffer;

    // Encrypt without additionalData (legacy / v1).
    const { ciphertext, iv } = await encryptData(plaintext, key);

    // Decrypt without additionalData should work.
    const roundTrip = await decryptData(ciphertext, key, iv);
    expect(new TextDecoder().decode(roundTrip)).toBe("legacy");

    // If a v1 item is mistakenly decrypted with v2 AAD, auth must fail.
    const aad = buildVaultMediaAadBytes({
      v: 2,
      userId: "user-1",
      mediaId: "media-1",
      variant: "original",
    });
    await expect(decryptData(ciphertext, key, iv, aad)).rejects.toBeTruthy();
  });

  test("v2 decrypt AAD can be resolved from encMeta.aad", () => {
    const encMeta = {
      v: 2,
      alg: "AES-256-GCM",
      ivB64: "ignored-in-this-test",
      aad: {
        purpose: "vault-media",
        metaVersion: 2,
        userId: "user-1",
        mediaId: "media-1",
        variant: "thumb",
      },
    };

    const expected = buildVaultMediaAadBytes({
      v: 2,
      userId: "user-1",
      mediaId: "media-1",
      variant: "thumb",
    });

    const resolved = resolveVaultMediaAadBytesForV2Decrypt({
      encMeta,
      mediaId: "media-1",
    });

    expect(resolved).toEqual(expected);
  });

  test("v2 decrypt AAD resolver rejects explicit context mismatch", () => {
    const encMeta = {
      v: 2,
      ivB64: "ignored-in-this-test",
      aad: {
        purpose: "vault-media",
        metaVersion: 2,
        userId: "user-1",
        mediaId: "media-1",
        variant: "original",
      },
    };

    expect(() =>
      resolveVaultMediaAadBytesForV2Decrypt({
        encMeta,
        mediaId: "media-1",
        userId: "user-2",
      }),
    ).toThrow(/AAD context mismatch/i);

    expect(() =>
      resolveVaultMediaAadBytesForV2Decrypt({
        encMeta,
        mediaId: "media-1",
        variant: "thumb",
      }),
    ).toThrow(/AAD context mismatch/i);
  });
});
