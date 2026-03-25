/**
 * centralized IndexedDB configuration to avoid version mismatch errors.
 * Manages schema for:
 * 1. Media Keys (keyStore.ts)
 * 2. Trusted Device Keys (trustedDevice.ts)
 */

export const DB_NAME = "BoosterVaultKeyStore";
export const DB_VERSION = 2;

export const STORE_MEDIA_KEYS = "media_keys";
export const STORE_TRUSTED_KEYS = "trusted_device_keys";

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store 1: Media Keys
      if (!db.objectStoreNames.contains(STORE_MEDIA_KEYS)) {
        db.createObjectStore(STORE_MEDIA_KEYS, { keyPath: "mediaId" });
      }

      // Store 2: Trusted Device Keys
      if (!db.objectStoreNames.contains(STORE_TRUSTED_KEYS)) {
        db.createObjectStore(STORE_TRUSTED_KEYS, { keyPath: "userId" });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}
