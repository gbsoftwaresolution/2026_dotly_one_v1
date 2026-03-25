/**
 * WebCrypto utilities for AES-GCM encryption/decryption, key derivation, and encoding.
 * Only uses WebCrypto API (no external libraries).
 */

/**
 * Convert ArrayBuffer to Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Accept standard base64 and base64url (RFC 4648), with or without padding.
  // Some backends/clients may omit padding or use '-'/'_' URL-safe chars.
  const normalized = base64
    .trim()
    .replace(/[\r\n\t\s]/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate random bytes as ArrayBuffer
 */
export function randomBytes(length: number): ArrayBuffer {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return array.buffer;
}

/**
 * Derive a key from a password using PBKDF2
 * @param password Plain text password
 * @param salt Salt as ArrayBuffer
 * @param iterations PBKDF2 iterations (default 300k)
 * @param keyLength Key length in bits (default 256)
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: ArrayBuffer,
  iterations = 300000,
  keyLength = 256,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: keyLength,
    },
    false, // not extractable (cannot export raw bytes)
    ["encrypt", "decrypt"],
  );
}

/**
 * Generate a random AES-GCM key
 */
export async function generateAesGcmKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // extractable (we need to export to wrap/store)
    ["encrypt", "decrypt"],
  );
}

/**
 * Export a CryptoKey to raw bytes (ArrayBuffer)
 */
export async function exportKeyRaw(key: CryptoKey): Promise<ArrayBuffer> {
  if (!key.extractable) {
    throw new Error("Key is not extractable");
  }
  return crypto.subtle.exportKey("raw", key);
}

/**
 * Import a raw key (ArrayBuffer) as AES-GCM CryptoKey
 */
export async function importKeyRaw(keyData: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    keyData,
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // extractable
    ["encrypt", "decrypt"],
  );
}

/**
 * Wrap (encrypt) a key with another key using AES-GCM
 * @param keyToWrap The key to wrap (must be extractable)
 * @param wrappingKey The key used for wrapping
 * @param iv Optional IV for wrapping (random if not provided)
 * @returns { wrappedKey: ArrayBuffer, iv: ArrayBuffer }
 */
export async function wrapKey(
  keyToWrap: CryptoKey,
  wrappingKey: CryptoKey,
  iv?: ArrayBuffer,
): Promise<{ wrappedKey: ArrayBuffer; iv: ArrayBuffer }> {
  const rawKey = await exportKeyRaw(keyToWrap);
  const wrapIv = iv || randomBytes(12); // 96-bit IV for AES-GCM

  const wrappedKey = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(wrapIv),
    },
    wrappingKey,
    rawKey,
  );

  return { wrappedKey, iv: wrapIv };
}

/**
 * Unwrap (decrypt) a wrapped key
 */
export async function unwrapKey(
  wrappedKey: ArrayBuffer,
  wrappingKey: CryptoKey,
  iv: ArrayBuffer,
): Promise<CryptoKey> {
  const rawKey = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(iv),
    },
    wrappingKey,
    wrappedKey,
  );

  return importKeyRaw(rawKey);
}

/**
 * Encrypt data with AES-GCM
 * @param data Data to encrypt (ArrayBuffer)
 * @param key AES-GCM CryptoKey
 * @param iv Optional IV (random if not provided)
 * @returns { ciphertext: ArrayBuffer, iv: ArrayBuffer }
 */
export async function encryptData(
  data: ArrayBuffer,
  key: CryptoKey,
  iv?: ArrayBuffer,
  additionalData?: Uint8Array,
): Promise<{ ciphertext: ArrayBuffer; iv: ArrayBuffer }> {
  const encryptIv = iv || randomBytes(12);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(encryptIv),
      ...(additionalData ? { additionalData } : {}),
    },
    key,
    data,
  );

  return { ciphertext, iv: encryptIv };
}

/**
 * Decrypt data with AES-GCM
 */
export async function decryptData(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: ArrayBuffer,
  additionalData?: Uint8Array,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(iv),
      ...(additionalData ? { additionalData } : {}),
    },
    key,
    ciphertext,
  );
}

/**
 * Convert file to ArrayBuffer (for encryption)
 */
export function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file as ArrayBuffer"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convert ArrayBuffer to Blob with mime type
 */
export function arrayBufferToBlob(buffer: ArrayBuffer, mimeType: string): Blob {
  return new Blob([buffer], { type: mimeType });
}
