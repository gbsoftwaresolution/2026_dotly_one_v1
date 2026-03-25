/**
 * Trusted device storage for encrypted master key.
 * Allows users to keep vault unlocked on trusted devices (optional).
 *
 * Security:
 * - Master key is encrypted with a key derived from user password + device-specific salt
 * - Encrypted blob stored in IndexedDB
 * - Device-specific salt stored in localStorage (cleared when user logs out or clears keys)
 * - Option is OFF by default, with clear warnings about shared computers
 */

import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  deriveKeyFromPassword,
  randomBytes,
  encryptData,
  decryptData,
} from "./webcrypto";
import {
  openDatabase,
  STORE_TRUSTED_KEYS as TRUSTED_KEY_STORE_NAME,
} from "./db";

const DEVICE_SALT_STORAGE_KEY = "booster_vault_device_salt";
const DEVICE_SECRET_STORAGE_KEY = "booster_vault_device_secret";

export interface TrustedDeviceKey {
  userId: string;
  scheme?: "password" | "device";
  encryptedMasterKey: ArrayBuffer;
  encryptionIv: ArrayBuffer;
  createdAt: number;
  expiresAt?: number; // Optional expiry
}

/**
 * Get or generate device-specific salt.
 * This salt is used to derive a device-specific key from the user password.
 * Stored in localStorage (cleared on logout/clear keys).
 */
export function getDeviceSalt(): ArrayBuffer {
  const stored = localStorage.getItem(DEVICE_SALT_STORAGE_KEY);
  if (stored) {
    return base64ToArrayBuffer(stored);
  }
  // Generate new device salt (16 bytes)
  const salt = randomBytes(16);
  localStorage.setItem(DEVICE_SALT_STORAGE_KEY, arrayBufferToBase64(salt));
  return salt;
}

/**
 * Clear device salt (called on logout or when clearing keys).
 */
export function clearDeviceSalt(): void {
  localStorage.removeItem(DEVICE_SALT_STORAGE_KEY);
}

function getOrCreateDeviceSecret(): ArrayBuffer {
  const stored = localStorage.getItem(DEVICE_SECRET_STORAGE_KEY);
  if (stored) {
    return base64ToArrayBuffer(stored);
  }

  // 32 bytes for AES-256 key material
  const secret = randomBytes(32);
  localStorage.setItem(DEVICE_SECRET_STORAGE_KEY, arrayBufferToBase64(secret));
  return secret;
}

function hasDeviceSecret(): boolean {
  return localStorage.getItem(DEVICE_SECRET_STORAGE_KEY) !== null;
}

function clearDeviceSecret(): void {
  localStorage.removeItem(DEVICE_SECRET_STORAGE_KEY);
}

async function getDeviceSecretKey(): Promise<CryptoKey> {
  const secret = getOrCreateDeviceSecret();
  return crypto.subtle.importKey(
    "raw",
    secret,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Derive device-specific key from password.
 * Uses device salt (different from vault salt) to create a unique key per device.
 */
export async function deriveDeviceKey(password: string): Promise<CryptoKey> {
  const deviceSalt = getDeviceSalt();
  // Intentionally pinned for backward compatibility: older trusted keys were derived
  // using the previous default iteration count.
  return deriveKeyFromPassword(password, deviceSalt, 200000);
}

/**
 * Check if device salt exists (i.e., this device has been initialized for trusted storage).
 */
export function hasDeviceSalt(): boolean {
  return localStorage.getItem(DEVICE_SALT_STORAGE_KEY) !== null;
}

/**
 * Store encrypted master key for trusted device.
 * @param userId User ID
 * @param masterKey The vault master key to encrypt and store
 * @param deviceKey Device-specific key derived from password
 */
export async function storeTrustedMasterKey(
  userId: string,
  masterKey: CryptoKey,
  deviceKey: CryptoKey,
): Promise<void> {
  // Export master key material
  const masterKeyMaterial = await crypto.subtle.exportKey("raw", masterKey);

  // Generate random IV for encryption
  const iv = randomBytes(12); // 12 bytes for AES-GCM

  // Encrypt master key with device key using encryptData
  const { ciphertext: encryptedMasterKey } = await encryptData(
    masterKeyMaterial,
    deviceKey,
    iv,
  );

  // Store in IndexedDB
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TRUSTED_KEY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(TRUSTED_KEY_STORE_NAME);

    const item: TrustedDeviceKey = {
      userId,
      scheme: "password",
      encryptedMasterKey,
      encryptionIv: iv,
      createdAt: Date.now(),
      // Optional: set expiry (e.g., 30 days)
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };

    const request = store.put(item);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error);
    };
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Store encrypted master key for trusted device without requiring the password on future unlocks.
 * NOTE: This relies on a device secret stored in localStorage.
 */
export async function storeTrustedMasterKeyForDevice(
  userId: string,
  masterKey: CryptoKey,
): Promise<void> {
  const deviceKey = await getDeviceSecretKey();

  const masterKeyMaterial = await crypto.subtle.exportKey("raw", masterKey);
  const iv = randomBytes(12);
  const { ciphertext: encryptedMasterKey } = await encryptData(
    masterKeyMaterial,
    deviceKey,
    iv,
  );

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TRUSTED_KEY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(TRUSTED_KEY_STORE_NAME);

    const item: TrustedDeviceKey = {
      userId,
      scheme: "device",
      encryptedMasterKey,
      encryptionIv: iv,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };

    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Restore master key using the device secret (no password).
 */
export async function retrieveTrustedMasterKeyForDevice(
  userId: string,
): Promise<CryptoKey | null> {
  if (!hasDeviceSecret()) {
    return null;
  }

  try {
    const db = await openDatabase();
    const item = await new Promise<TrustedDeviceKey | null>(
      (resolve, reject) => {
        const transaction = db.transaction(TRUSTED_KEY_STORE_NAME, "readonly");
        const store = transaction.objectStore(TRUSTED_KEY_STORE_NAME);
        const request = store.get(userId);

        request.onsuccess = () => {
          const result = request.result as TrustedDeviceKey | undefined;
          resolve(result || null);
        };
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      },
    );

    if (!item) return null;
    if ((item.scheme || "password") !== "device") return null;

    if (item.expiresAt && Date.now() > item.expiresAt) {
      await removeTrustedMasterKey(userId);
      return null;
    }

    const deviceKey = await getDeviceSecretKey();
    const decryptedMaterial = await decryptData(
      item.encryptedMasterKey,
      deviceKey,
      item.encryptionIv,
    );

    return crypto.subtle.importKey(
      "raw",
      decryptedMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
  } catch (error) {
    console.error(
      "Failed to retrieve trusted master key (device scheme):",
      error,
    );
    return null;
  }
}

/**
 * Retrieve and decrypt master key from trusted device storage.
 * @param userId User ID
 * @param deviceKey Device-specific key derived from password
 * @returns Decrypted master key, or null if not found or decryption fails
 */
export async function retrieveTrustedMasterKey(
  userId: string,
  deviceKey: CryptoKey,
): Promise<CryptoKey | null> {
  try {
    const db = await openDatabase();
    const item = await new Promise<TrustedDeviceKey | null>(
      (resolve, reject) => {
        const transaction = db.transaction(TRUSTED_KEY_STORE_NAME, "readonly");
        const store = transaction.objectStore(TRUSTED_KEY_STORE_NAME);
        const request = store.get(userId);

        request.onsuccess = () => {
          const result = request.result as TrustedDeviceKey | undefined;
          resolve(result || null);
        };
        request.onerror = () => {
          reject(request.error);
        };
        transaction.oncomplete = () => db.close();
      },
    );

    if (!item) {
      return null;
    }

    // Check expiry (optional)
    if (item.expiresAt && Date.now() > item.expiresAt) {
      await removeTrustedMasterKey(userId);
      return null;
    }

    // Decrypt master key using decryptData
    const decryptedMaterial = await decryptData(
      item.encryptedMasterKey,
      deviceKey,
      item.encryptionIv,
    );

    // Import as CryptoKey
    const masterKey = await crypto.subtle.importKey(
      "raw",
      decryptedMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );

    return masterKey;
  } catch (error) {
    console.error("Failed to retrieve trusted master key:", error);
    return null;
  }
}

/**
 * Remove trusted master key for user (e.g., when untrusting device or changing password).
 */
export async function removeTrustedMasterKey(userId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TRUSTED_KEY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(TRUSTED_KEY_STORE_NAME);
    const request = store.delete(userId);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error);
    };
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Check if trusted master key exists for user.
 */
export async function hasTrustedMasterKey(userId: string): Promise<boolean> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TRUSTED_KEY_STORE_NAME, "readonly");
    const store = transaction.objectStore(TRUSTED_KEY_STORE_NAME);
    const request = store.get(userId);

    request.onsuccess = () => {
      const result = request.result as TrustedDeviceKey | undefined;
      resolve(!!result);
    };
    request.onerror = () => {
      reject(request.error);
    };
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Clear all trusted device data (including device salt).
 * Called on logout or when clearing all keys.
 */
export async function clearAllTrustedDeviceData(): Promise<void> {
  // Clear device salt
  clearDeviceSalt();
  clearDeviceSecret();

  // Clear all trusted keys from IndexedDB
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TRUSTED_KEY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(TRUSTED_KEY_STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error);
    };
    transaction.oncomplete = () => db.close();
  });
}

export function hasTrustedDeviceSecret(): boolean {
  return hasDeviceSecret();
}
