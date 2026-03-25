/**
 * IndexedDB wrapper for storing wrapped media keys.
 * Each media key is encrypted with the vault master key.
 */

import { arrayBufferToBase64, base64ToArrayBuffer } from "./webcrypto";
import { openDatabase, STORE_MEDIA_KEYS as STORE_NAME } from "./db";

export interface WrappedMediaKey {
  mediaId: string;
  wrappedKey: ArrayBuffer; // encrypted media key
  wrapIv: ArrayBuffer; // IV used for wrapping
  createdAt: number;
}

/**
 * Store a wrapped media key.
 */
export async function storeWrappedKey(
  mediaId: string,
  wrappedKey: ArrayBuffer,
  wrapIv: ArrayBuffer,
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const item: WrappedMediaKey = {
      mediaId,
      wrappedKey,
      wrapIv,
      createdAt: Date.now(),
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
 * Retrieve a wrapped media key.
 * @returns WrappedMediaKey or null if not found
 */
export async function getWrappedKey(
  mediaId: string,
): Promise<WrappedMediaKey | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(mediaId);

    request.onsuccess = () => {
      const result = request.result as WrappedMediaKey | undefined;
      resolve(result || null);
    };
    request.onerror = () => {
      reject(request.error);
    };
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Remove a wrapped media key.
 */
export async function removeWrappedKey(mediaId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(mediaId);

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
 * List all media IDs for which keys are stored.
 */
export async function listMediaIds(): Promise<string[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onsuccess = () => {
      const keys = request.result as string[];
      resolve(keys);
    };
    request.onerror = () => {
      reject(request.error);
    };
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Count stored keys.
 */
export async function countKeys(): Promise<number> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Clear all stored keys (dangerous!).
 */
export async function clearAllKeys(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
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

/**
 * Export wrapped keys as JSON (base64 encoded).
 * Useful for backup (though wrapped keys require master key to unwrap).
 */
export async function exportWrappedKeys(): Promise<string> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = request.result as WrappedMediaKey[];
      const exportData = items.map((item) => ({
        mediaId: item.mediaId,
        wrappedKey: arrayBufferToBase64(item.wrappedKey),
        wrapIv: arrayBufferToBase64(item.wrapIv),
        createdAt: item.createdAt,
      }));
      resolve(JSON.stringify(exportData, null, 2));
    };
    request.onerror = () => {
      reject(request.error);
    };
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Import wrapped keys from JSON (base64 encoded).
 */
export async function importWrappedKeys(json: string): Promise<void> {
  const items = JSON.parse(json) as Array<{
    mediaId: string;
    wrappedKey: string;
    wrapIv: string;
    createdAt?: number;
  }>;

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    let errorOccurred = false;
    items.forEach((item) => {
      const wrappedKey = base64ToArrayBuffer(item.wrappedKey);
      const wrapIv = base64ToArrayBuffer(item.wrapIv);
      const record: WrappedMediaKey = {
        mediaId: item.mediaId,
        wrappedKey,
        wrapIv,
        createdAt: item.createdAt || Date.now(),
      };
      const request = store.put(record);
      request.onerror = () => {
        errorOccurred = true;
        reject(request.error);
      };
    });

    transaction.oncomplete = () => {
      if (!errorOccurred) {
        resolve();
      }
    };
    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}
