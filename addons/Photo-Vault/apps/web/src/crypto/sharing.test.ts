import { describe, expect, test } from "vitest";

import { generatePassphrase } from "./sharing";
import { BIP39_EN_WORDLIST } from "./wordlists/bip39-en";

describe("sharing crypto", () => {
  test("generatePassphrase() returns 6 lowercase words separated by hyphens", () => {
    const mutableCrypto = crypto as unknown as {
      getRandomValues: (arr: Uint16Array) => Uint16Array;
    };
    const originalGetRandomValues = mutableCrypto.getRandomValues.bind(crypto);

    try {
      // Make deterministic: indices 0..5.
      mutableCrypto.getRandomValues = (arr: Uint16Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = i;
        }
        return arr;
      };

      const passphrase = generatePassphrase();

      expect(passphrase).toMatch(/^[a-z]+(-[a-z]+){5}$/);
      const parts = passphrase.split("-");
      expect(parts).toHaveLength(6);
      expect(parts.every((w) => w === w.toLowerCase())).toBe(true);

      // Also ensure these are real BIP-39 words.
      expect(parts.every((w) => BIP39_EN_WORDLIST.includes(w))).toBe(true);

      // Deterministic expectation (first 6 words in the list).
      expect(passphrase).toBe(
        [
          BIP39_EN_WORDLIST[0],
          BIP39_EN_WORDLIST[1],
          BIP39_EN_WORDLIST[2],
          BIP39_EN_WORDLIST[3],
          BIP39_EN_WORDLIST[4],
          BIP39_EN_WORDLIST[5],
        ].join("-"),
      );
    } finally {
      mutableCrypto.getRandomValues = originalGetRandomValues;
    }
  });

  test("generatePassphrase({words}) respects word count", () => {
    const mutableCrypto = crypto as unknown as {
      getRandomValues: (arr: Uint16Array) => Uint16Array;
    };
    const originalGetRandomValues = mutableCrypto.getRandomValues.bind(crypto);

    try {
      mutableCrypto.getRandomValues = (arr: Uint16Array) => {
        arr.fill(7);
        return arr;
      };

      expect(generatePassphrase({ words: 1 }).split("-")).toHaveLength(1);
      expect(generatePassphrase({ words: 6 }).split("-")).toHaveLength(6);
      expect(generatePassphrase({ words: 8 }).split("-")).toHaveLength(8);
    } finally {
      mutableCrypto.getRandomValues = originalGetRandomValues;
    }
  });
});
