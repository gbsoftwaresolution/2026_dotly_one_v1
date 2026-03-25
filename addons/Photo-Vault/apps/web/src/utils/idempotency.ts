/**
 * Utilities for generating and managing idempotency keys for API requests.
 */

/**
 * Generate a new idempotency key (UUID v4).
 * Uses crypto.randomUUID() when available, falls back to a simple implementation.
 */
export function generateIdempotencyKey(): string {
  // Use globalThis to access crypto in both browser and Node.js environments
  const globalCrypto = (globalThis as any).crypto;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID()
  // Simple UUID v4 implementation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create headers object with Idempotency-Key header.
 * @param key - The idempotency key to include (if not provided, generates a new one)
 * @returns Headers object with Idempotency-Key set
 */
export function withIdempotencyKey(key?: string): Record<string, string> {
  const idempotencyKey = key || generateIdempotencyKey();
  return {
    "Idempotency-Key": idempotencyKey,
  };
}

/**
 * In-memory store for idempotency keys per operation.
 * This allows retrying the same operation with the same key.
 */
export class IdempotencyKeyStore {
  private store = new Map<string, string>();

  /**
   * Get or generate an idempotency key for a specific operation.
   * @param operationId - Unique identifier for the operation (e.g., 'upload:file123')
   * @returns The idempotency key to use
   */
  getKey(operationId: string): string {
    if (!this.store.has(operationId)) {
      this.store.set(operationId, generateIdempotencyKey());
    }
    return this.store.get(operationId)!;
  }

  /**
   * Set a specific idempotency key for an operation.
   */
  setKey(operationId: string, key: string): void {
    this.store.set(operationId, key);
  }

  /**
   * Clear the key for an operation (after completion or error).
   */
  clearKey(operationId: string): void {
    this.store.delete(operationId);
  }

  /**
   * Clear all stored keys.
   */
  clearAll(): void {
    this.store.clear();
  }
}

// Default global instance
export const globalIdempotencyStore = new IdempotencyKeyStore();
