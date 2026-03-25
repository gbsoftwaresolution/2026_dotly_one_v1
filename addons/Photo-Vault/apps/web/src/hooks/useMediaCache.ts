import { useState, useCallback, useRef, useEffect } from "react";
import type { MediaResponse } from "../types/api";
import { mediaApi } from "../api/media";
import { ApiError } from "../api/client";
import { fetchAndDecrypt, canDecryptMedia } from "../crypto/decrypt";
import { isMasterKeyCached } from "../crypto/vaultKey";
import { useAuth } from "../app/AuthProvider";

interface CachedMedia {
  mediaId: string;
  objectUrl: string;
  timestamp: number;
}

const MAX_CACHE_SIZE = 10;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useMediaCache = () => {
  const { user } = useAuth();
  const cache = useRef<Map<string, CachedMedia>>(new Map());
  const [loadingMedia, setLoadingMedia] = useState<Set<string>>(new Set());
  const inFlight = useRef<Map<string, Promise<string>>>(new Map());

  const cleanupCache = useCallback(() => {
    const now = Date.now();
    for (const [mediaId, cached] of cache.current.entries()) {
      if (now - cached.timestamp > CACHE_TTL) {
        URL.revokeObjectURL(cached.objectUrl);
        cache.current.delete(mediaId);
      }
    }

    // If still over limit, remove oldest entries
    if (cache.current.size > MAX_CACHE_SIZE) {
      const entries = Array.from(cache.current.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, cache.current.size - MAX_CACHE_SIZE);
      toRemove.forEach(([mediaId, cached]) => {
        URL.revokeObjectURL(cached.objectUrl);
        cache.current.delete(mediaId);
      });
    }
  }, []);

  const getCachedUrl = useCallback(
    (mediaId: string): string | null => {
      cleanupCache();
      const cached = cache.current.get(mediaId);
      return cached ? cached.objectUrl : null;
    },
    [cleanupCache],
  );

  const cacheMedia = useCallback(
    (mediaId: string, objectUrl: string) => {
      cleanupCache();
      // If already cached, revoke old URL
      const existing = cache.current.get(mediaId);
      if (existing) {
        URL.revokeObjectURL(existing.objectUrl);
      }

      cache.current.set(mediaId, {
        mediaId,
        objectUrl,
        timestamp: Date.now(),
      });
    },
    [cleanupCache],
  );

  const removeFromCache = useCallback((mediaId: string) => {
    const cached = cache.current.get(mediaId);
    if (cached) {
      URL.revokeObjectURL(cached.objectUrl);
      cache.current.delete(mediaId);
    }
  }, []);

  const clearCache = useCallback(() => {
    cache.current.forEach((cached) => {
      URL.revokeObjectURL(cached.objectUrl);
    });
    cache.current.clear();
  }, []);

  const loadMedia = useCallback(
    async (media: MediaResponse): Promise<string> => {
      const mediaId = media.id;
      const userId = user?.id;
      if (!userId) {
        throw new Error("Missing user session");
      }

      // Cache first
      const cachedUrl = getCachedUrl(mediaId);
      if (cachedUrl) return cachedUrl;

      // Dedupe concurrent loads for the same media
      const existing = inFlight.current.get(mediaId);
      if (existing) return existing;

      const getIvB64 = (encMeta: unknown): string | undefined => {
        if (!encMeta || typeof encMeta !== "object") return undefined;
        const meta = encMeta as { ivB64?: unknown; iv?: unknown };
        if (typeof meta.ivB64 === "string") return meta.ivB64;
        if (typeof meta.iv === "string") return meta.iv;
        return undefined;
      };

      const task = (async () => {
        setLoadingMedia((prev) => new Set(prev).add(mediaId));
        try {
          const thumbIvB64 = getIvB64(media.thumbEncMeta);
          const originalIvB64 = getIvB64(media.encMeta);

          const hasThumb = Boolean(
            media.thumbUploadedAt && thumbIvB64 && media.thumbContentType,
          );

          // For grid previews we avoid fetching/decrypting full videos.
          // If a video has no encrypted thumbnail stored, keep the placeholder.
          if (!hasThumb && media.type === "VIDEO") {
            throw new Error("Video thumbnail not available");
          }

          const variant: "thumb" | "original" = hasThumb ? "thumb" : "original";
          const signed = await getDownloadUrlWithRetry(mediaId, variant);

          const ivB64 = hasThumb ? thumbIvB64 : originalIvB64;
          const mimeType = hasThumb
            ? media.thumbContentType
            : media.contentType;

          if (!ivB64) {
            throw new Error("Missing encryption metadata (ivB64)");
          }

          if (!mimeType) {
            throw new Error("Missing content type for preview");
          }

          const objectUrl = await fetchAndDecrypt({
            userId,
            mediaId,
            downloadUrl: signed.url,
            encMeta: hasThumb ? media.thumbEncMeta : media.encMeta,
            variant,
            mimeType,
          });
          cacheMedia(mediaId, objectUrl);
          return objectUrl;
        } finally {
          inFlight.current.delete(mediaId);
          setLoadingMedia((prev) => {
            const next = new Set(prev);
            next.delete(mediaId);
            return next;
          });
        }
      })();

      inFlight.current.set(mediaId, task);
      return task;
    },
    [cacheMedia, getCachedUrl, user?.id],
  );

  const getDownloadUrlWithRetry = useCallback(
    async (mediaId: string, variant: "original" | "thumb") => {
      const delaysMs = [0, 500, 1500, 3000];
      let lastError: unknown;
      for (const delayMs of delaysMs) {
        if (delayMs) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
        try {
          return await mediaApi.getDownloadUrl(mediaId, variant);
        } catch (err) {
          lastError = err;
          if (err instanceof ApiError && err.status === 429) {
            continue;
          }
          throw err;
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error("Failed to get download URL");
    },
    [],
  );

  const prefetchMedia = useCallback(
    async (media: MediaResponse) => {
      const mediaId = media.id;
      if (cache.current.has(mediaId) || loadingMedia.has(mediaId)) {
        return;
      }

      // Only prefetch if vault is unlocked
      if (!isMasterKeyCached()) {
        return;
      }

      // Only prefetch small media (< 5MB) to avoid bandwidth waste
      if (media.byteSize > 5 * 1024 * 1024) {
        return;
      }

      // Start loading in background
      loadMedia(media).catch(() => {
        // Silent fail for prefetch
      });
    },
    [loadMedia, loadingMedia],
  );

  const canPreview = useCallback(async (mediaId: string): Promise<boolean> => {
    // Check if vault is unlocked and key exists
    if (!isMasterKeyCached()) {
      return false;
    }
    return canDecryptMedia(mediaId);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCache();
    };
  }, [clearCache]);

  return {
    loadMedia,
    prefetchMedia,
    getCachedUrl,
    removeFromCache,
    clearCache,
    canPreview,
    isLoading: (mediaId: string) => loadingMedia.has(mediaId),
    cacheSize: cache.current.size,
  };
};
