export const PERMISSION_RESOLVER_VERSION = "2026-03-26.prompt-114";

export interface PermissionCacheEntry<T> {
  cacheKey: string;
  value: T;
  createdAt: Date;
  expiresAt: Date;
  versionTag: string | null;
}

export interface PermissionCacheKeyParts {
  scope:
    | "connection-permissions"
    | "conversation-context"
    | "content-permissions";
  connectionId?: string;
  conversationId?: string;
  contentId?: string;
  targetIdentityId?: string;
}

export class PermissionCacheStore {
  private readonly entries = new Map<string, PermissionCacheEntry<unknown>>();

  get<T>(key: string): PermissionCacheEntry<T> | null {
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt.getTime() <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    return entry as PermissionCacheEntry<T>;
  }

  set<T>(key: string, value: T, ttlMs: number, versionTag?: string | null) {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ttlMs);
    const entry: PermissionCacheEntry<T> = {
      cacheKey: key,
      value,
      createdAt,
      expiresAt,
      versionTag: versionTag ?? null,
    };

    this.entries.set(key, entry as PermissionCacheEntry<unknown>);
    return entry;
  }

  delete(key: string) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }

  has(key: string) {
    return this.get(key) !== null;
  }
}

export function createConnectionPermissionCacheKey(connectionId: string) {
  return `connection-permissions:${connectionId}`;
}

export function createConversationContextCacheKey(conversationId: string) {
  return `conversation-context:${conversationId}`;
}

export function createContentPermissionCacheKey(
  connectionId: string,
  contentId: string,
  targetIdentityId: string,
) {
  return `content-permissions:${connectionId}:${contentId}:${targetIdentityId}`;
}
