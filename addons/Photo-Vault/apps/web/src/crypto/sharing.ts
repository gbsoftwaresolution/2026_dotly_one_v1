/**
 * Crypto utilities for album sharing
 * Reuses webcrypto helpers for zero-knowledge sharing
 */

import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  randomBytes,
  deriveKeyFromPassword,
  generateAesGcmKey,
  wrapKey,
  unwrapKey,
} from "./webcrypto";
import { BIP39_EN_WORDLIST } from "./wordlists/bip39-en";

/**
 * Generate a human-readable share passphrase.
 *
 * Default: 6 words from a 2048-word list (BIP-39 English) => 6 * 11 = 66 bits entropy.
 * This is high enough that offline guessing is not feasible.
 */
export function generatePassphrase({
  words = 6,
}: { words?: number } = {}): string {
  if (!Number.isInteger(words) || words < 1) {
    throw new Error("words must be a positive integer");
  }

  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) {
    throw new Error("Web Crypto API not available");
  }

  const randomValues = new Uint16Array(words);
  cryptoObj.getRandomValues(randomValues);

  const selected: string[] = [];
  for (let i = 0; i < words; i++) {
    // 2048 == 2^11; masking is uniform with Uint16 randomness.
    const idx = randomValues[i]! & 2047;
    selected.push(BIP39_EN_WORDLIST[idx]!);
  }

  return selected.join("-");
}

/**
 * Derive a Share Key Encryption Key (KEK) from passphrase
 */
export async function deriveShareKek(
  passphrase: string,
  salt: ArrayBuffer,
  iterations: number,
): Promise<CryptoKey> {
  return deriveKeyFromPassword(passphrase, salt, iterations, 256);
}

/**
 * Wrap an album share key with passphrase-derived KEK
 * Returns encrypted key and IV as base64 strings
 */
export async function wrapAlbumShareKey(
  albumShareKey: CryptoKey,
  kek: CryptoKey,
): Promise<{ encryptedKey: string; iv: string }> {
  const { wrappedKey, iv } = await wrapKey(albumShareKey, kek);
  return {
    encryptedKey: arrayBufferToBase64(wrappedKey),
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Unwrap an album share key using passphrase-derived KEK
 */
export async function unwrapAlbumShareKey(
  encryptedKey: string, // base64
  kek: CryptoKey,
  iv: string, // base64
): Promise<CryptoKey> {
  const wrappedKeyBuffer = base64ToArrayBuffer(encryptedKey);
  const ivBuffer = base64ToArrayBuffer(iv);
  return unwrapKey(wrappedKeyBuffer, kek, ivBuffer);
}

/**
 * Wrap a media key with album share key
 */
export async function wrapMediaKeyWithAlbumKey(
  mediaKey: CryptoKey,
  albumShareKey: CryptoKey,
): Promise<{ encryptedKey: string; iv: string }> {
  const { wrappedKey, iv } = await wrapKey(mediaKey, albumShareKey);
  return {
    encryptedKey: arrayBufferToBase64(wrappedKey),
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Unwrap a media key using album share key
 */
export async function unwrapMediaKeyWithAlbumKey(
  encryptedKey: string, // base64
  albumShareKey: CryptoKey,
  iv: string, // base64
): Promise<CryptoKey> {
  const wrappedKeyBuffer = base64ToArrayBuffer(encryptedKey);
  const ivBuffer = base64ToArrayBuffer(iv);
  return unwrapKey(wrappedKeyBuffer, albumShareKey, ivBuffer);
}

/**
 * Generate a random album share key (256-bit AES-GCM)
 */
export async function generateAlbumShareKey(): Promise<CryptoKey> {
  return generateAesGcmKey();
}

/**
 * Derive KEK from passphrase and unwrap album share key from bundle
 * Full client-side unlock flow
 */
export async function unlockShareBundle(
  passphrase: string,
  bundle: {
    encryptedAlbumKey: string;
    iv: string;
    kdfParams: { iterations: number; hash: string; salt: string };
  },
): Promise<{ albumShareKey: CryptoKey }> {
  const salt = base64ToArrayBuffer(bundle.kdfParams.salt);
  const kek = await deriveShareKek(
    passphrase,
    salt,
    bundle.kdfParams.iterations,
  );
  const albumShareKey = await unwrapAlbumShareKey(
    bundle.encryptedAlbumKey,
    kek,
    bundle.iv,
  );
  return { albumShareKey };
}

/**
 * Prepare share bundle for uploading
 * 1. Generate random album share key
 * 2. Derive KEK from passphrase
 * 3. Wrap album share key with KEK
 * 4. For each media item, unwrap with vault master key and rewrap with album share key
 */
export async function prepareShareBundle(
  passphrase: string,
  mediaKeys: Array<{ mediaId: string; mediaKey: CryptoKey }>,
  kdfParams: { iterations: number; salt: string },
): Promise<{
  albumShareKey: CryptoKey;
  encryptedAlbumKey: string;
  encryptedMediaKeys: Array<{
    mediaId: string;
    encryptedKey: string;
    iv: string;
  }>;
  iv: string;
}> {
  // Generate random album share key
  const albumShareKey = await generateAlbumShareKey();

  // Derive KEK from passphrase
  const salt = base64ToArrayBuffer(kdfParams.salt);
  const kek = await deriveShareKek(passphrase, salt, kdfParams.iterations);

  // Wrap album share key with KEK
  const { encryptedKey: encryptedAlbumKey, iv } = await wrapAlbumShareKey(
    albumShareKey,
    kek,
  );

  // Wrap each media key with album share key
  const encryptedMediaKeys = await Promise.all(
    mediaKeys.map(async ({ mediaId, mediaKey }) => {
      const { encryptedKey, iv: mediaIv } = await wrapMediaKeyWithAlbumKey(
        mediaKey,
        albumShareKey,
      );
      return { mediaId, encryptedKey, iv: mediaIv };
    }),
  );

  return {
    albumShareKey,
    encryptedAlbumKey,
    encryptedMediaKeys,
    iv,
  };
}

/**
 * Generate KDF parameters for share passphrase derivation
 */
export function generateKdfParams(iterations = 200000): {
  iterations: number;
  hash: string;
  salt: string;
} {
  const salt = randomBytes(16); // 128-bit salt
  return {
    iterations,
    hash: "SHA-256",
    salt: arrayBufferToBase64(salt),
  };
}
