import { describe, expect, test } from "vitest";

import {
  confirmRecoveryPhrase,
  deriveRecoveryKeyFromSalt,
  generateConfirmationIndices,
  generateRecoveryPhrase,
  unwrapVaultMasterKey,
  validateRecoveryPhraseFormat,
  wrapVaultMasterKey,
} from "./recovery";
import { randomBytes } from "./webcrypto";

async function generateTestMasterKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

describe("recovery crypto", () => {
  test("generateRecoveryPhrase returns 12 lowercase words", () => {
    const phrase = generateRecoveryPhrase();
    expect(phrase).toHaveLength(12);
    expect(phrase.every((w) => w === w.toLowerCase())).toBe(true);
  });

  test("validateRecoveryPhraseFormat accepts valid phrases", () => {
    const phrase = generateRecoveryPhrase();
    expect(validateRecoveryPhraseFormat(phrase)).toBe(true);
  });

  test("generateConfirmationIndices returns 2-3 unique indices in range", () => {
    const indices = generateConfirmationIndices();
    expect(indices.length === 2 || indices.length === 3).toBe(true);
    expect(new Set(indices).size).toBe(indices.length);
    expect(indices.every((i) => i >= 0 && i < 12)).toBe(true);
  });

  test("confirmRecoveryPhrase passes for correct words and fails for wrong words", () => {
    const phrase = generateRecoveryPhrase();
    const indices = generateConfirmationIndices();

    const correct = indices.map((idx) => phrase[idx] as string);
    expect(confirmRecoveryPhrase(phrase, correct, indices)).toBe(true);

    const wrong = indices.map(() => "wrongword");
    expect(confirmRecoveryPhrase(phrase, wrong, indices)).toBe(false);
  });

  test("deriveRecoveryKeyFromSalt derives a usable AES-GCM key (fast iterations)", async () => {
    const phrase = generateRecoveryPhrase();
    const salt = randomBytes(16);
    const recoveryKey = await deriveRecoveryKeyFromSalt(phrase, salt, 5_000);
    expect(recoveryKey.algorithm.name).toBe("AES-GCM");
  });

  test("wrapVaultMasterKey + unwrapVaultMasterKey roundtrip, wrong key fails", async () => {
    const phrase = generateRecoveryPhrase();
    const salt = randomBytes(16);
    const recoveryKey = await deriveRecoveryKeyFromSalt(phrase, salt, 5_000);
    const masterKey = await generateTestMasterKey();

    const wrapped = await wrapVaultMasterKey(
      masterKey,
      recoveryKey,
      salt,
      5_000,
    );
    expect(typeof wrapped.encryptedMasterKey).toBe("string");
    expect(typeof wrapped.iv).toBe("string");
    expect(wrapped.encryptedMasterKey.length).toBeGreaterThan(0);
    expect(wrapped.iv.length).toBeGreaterThan(0);

    const unwrapped = await unwrapVaultMasterKey(
      wrapped.encryptedMasterKey,
      wrapped.iv,
      recoveryKey,
    );
    expect(unwrapped.algorithm.name).toBe("AES-GCM");

    const wrongPhrase = generateRecoveryPhrase();
    const wrongRecoveryKey = await deriveRecoveryKeyFromSalt(
      wrongPhrase,
      salt,
      5_000,
    );
    await expect(
      unwrapVaultMasterKey(
        wrapped.encryptedMasterKey,
        wrapped.iv,
        wrongRecoveryKey,
      ),
    ).rejects.toThrow();
  });

  test("validateRecoveryPhraseFormat rejects invalid phrases", () => {
    const phrase = generateRecoveryPhrase();
    const shortPhrase = ["word1", "word2", "word3"];
    const longPhrase = Array(15).fill("word");
    const invalidWordPhrase = [...phrase.slice(0, 11), "notaword"];

    expect(validateRecoveryPhraseFormat(shortPhrase)).toBe(false);
    expect(validateRecoveryPhraseFormat(longPhrase)).toBe(false);
    expect(validateRecoveryPhraseFormat(invalidWordPhrase)).toBe(false);
  });
});
