import { useCallback, useEffect, useRef } from "react";

// Simple event emitter for data invalidation
class InvalidationEmitter {
  private listeners: Map<string, Set<() => void>> = new Map();

  on(event: string, callback: () => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: () => void) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  emit(event: string) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach((callback) => callback());
    }
  }

  // Convenience method for media-related invalidations
  invalidateMedia() {
    this.emit("media");
  }

  invalidateAlbums() {
    this.emit("albums");
  }

  invalidateLibrary() {
    this.emit("library");
  }

  invalidateTimeline() {
    this.emit("timeline");
  }

  invalidateSearch() {
    this.emit("search");
  }

  invalidateTrash() {
    this.emit("trash");
  }

  invalidateExports() {
    this.emit("exports");
  }

  invalidateSubscription() {
    this.emit("subscription");
  }

  // Invalidate everything (e.g., after major actions)
  invalidateAll() {
    this.emit("media");
    this.emit("albums");
    this.emit("library");
    this.emit("timeline");
    this.emit("search");
    this.emit("trash");
    this.emit("exports");
    this.emit("subscription");
  }
}

// Singleton instance
const emitter = new InvalidationEmitter();

// Hook for listening to invalidation events
export function useInvalidate(event: string, callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = emitter.on(event, () => {
      callbackRef.current();
    });
    return unsubscribe;
  }, [event]);
}

// Hook for triggering invalidations
export function useInvalidator() {
  const invalidateMedia = useCallback(() => {
    emitter.invalidateMedia();
  }, []);

  const invalidateAlbums = useCallback(() => {
    emitter.invalidateAlbums();
  }, []);

  const invalidateLibrary = useCallback(() => {
    emitter.invalidateLibrary();
  }, []);

  const invalidateTimeline = useCallback(() => {
    emitter.invalidateTimeline();
  }, []);

  const invalidateSearch = useCallback(() => {
    emitter.invalidateSearch();
  }, []);

  const invalidateTrash = useCallback(() => {
    emitter.invalidateTrash();
  }, []);

  const invalidateExports = useCallback(() => {
    emitter.invalidateExports();
  }, []);

  const invalidateSubscription = useCallback(() => {
    emitter.invalidateSubscription();
  }, []);

  const invalidateAll = useCallback(() => {
    emitter.invalidateAll();
  }, []);

  return {
    invalidateMedia,
    invalidateAlbums,
    invalidateLibrary,
    invalidateTimeline,
    invalidateSearch,
    invalidateTrash,
    invalidateExports,
    invalidateSubscription,
    invalidateAll,
  };
}

// Direct emitter export for non-React usage
export const invalidationEmitter = emitter;
