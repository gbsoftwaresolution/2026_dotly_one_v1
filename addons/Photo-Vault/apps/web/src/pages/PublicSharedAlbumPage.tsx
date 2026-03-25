import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sharingApi } from "../api/sharing";
import { ApiError } from "../api/client";
import type {
  SharedAlbumMetadataResponse,
  EncryptedShareBundleResponse,
} from "@booster-vault/shared";
import { MediaGrid } from "../components/MediaGrid";
import { MediaViewer } from "../components/MediaViewer";
import { unlockShareBundle } from "../crypto/sharing";
import { base64ToArrayBuffer } from "../crypto/webcrypto";
import { unwrapKey } from "../crypto/webcrypto";
import { fetchAndDecryptShared } from "../crypto/decrypt";
import { LockIcon, ShieldIcon, KeyIcon, CameraIcon } from "../components/icons";

// --- Helper Functions ---

function extractUuid(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  const match = trimmed.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  );
  return match ? match[0] : null;
}

// --- Components ---

const LoadingSkeleton = () => (
  <div
    style={{
      padding: "var(--space-8)",
      maxWidth: "1200px",
      margin: "0 auto",
      color: "var(--text-primary)",
    }}
  >
    <div
      style={{
        height: "40px",
        width: "300px",
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-md)",
        marginBottom: "var(--space-4)",
      }}
    />
    <div
      style={{
        height: "20px",
        width: "200px",
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-md)",
        marginBottom: "var(--space-8)",
      }}
    />
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "var(--space-4)",
      }}
    >
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          style={{
            aspectRatio: "1",
            background: "var(--bg-elevated)",
            borderRadius: "var(--radius-md)",
          }}
        />
      ))}
    </div>
  </div>
);

const ErrorView = ({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--space-8)",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      textAlign: "center",
    }}
  >
    <div
      style={{
        color: "var(--danger)",
        background: "var(--danger-light)",
        padding: "var(--space-4)",
        borderRadius: "50%",
        marginBottom: "var(--space-6)",
      }}
    >
      <ShieldIcon size={48} />
    </div>
    <h1
      style={{
        fontSize: "2rem",
        fontWeight: "700",
        marginBottom: "var(--space-4)",
      }}
    >
      {title}
    </h1>
    <p
      style={{
        color: "var(--text-secondary)",
        maxWidth: "500px",
        marginBottom: "var(--space-8)",
        lineHeight: 1.6,
      }}
    >
      {message}
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        style={{
          padding: "var(--space-3) var(--space-6)",
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-primary)",
          borderRadius: "var(--radius-full)",
          cursor: "pointer",
          fontSize: "1rem",
        }}
      >
        Return Home
      </button>
    )}
  </div>
);

const LockScreen = ({
  metadata,
  passphrase,
  setPassphrase,
  onUnlock,
  isUnlocking,
  error,
}: any) => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-primary)",
      padding: "var(--space-4)",
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: "480px",
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-8)",
        boxShadow: "var(--shadow-xl)",
        border: "1px solid var(--border-primary)",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "var(--space-8)" }}>
        <div
          style={{
            display: "inline-flex",
            padding: "var(--space-3)",
            background: "rgba(0, 212, 255, 0.1)",
            borderRadius: "50%",
            color: "var(--accent-primary)",
            marginBottom: "var(--space-4)",
          }}
        >
          <LockIcon size={32} />
        </div>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: "700",
            color: "var(--text-primary)",
            marginBottom: "var(--space-2)",
          }}
        >
          {metadata.album.name}
        </h1>
        {metadata.album.description && (
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            {metadata.album.description}
          </p>
        )}
      </div>

      <form onSubmit={onUnlock}>
        <div style={{ marginBottom: "var(--space-6)" }}>
          <label
            style={{
              display: "block",
              color: "var(--text-secondary)",
              fontSize: "0.875rem",
              marginBottom: "var(--space-2)",
              fontWeight: "500",
            }}
          >
            Passphrase Required
          </label>
          <div style={{ position: "relative" }}>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter album passphrase"
              style={{
                width: "100%",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-primary)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                fontSize: "1rem",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              autoFocus
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "var(--space-3)",
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              borderRadius: "var(--radius-md)",
              marginBottom: "var(--space-6)",
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <span>⚠️</span> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!passphrase.trim() || isUnlocking}
          style={{
            width: "100%",
            padding: "var(--space-3)",
            background: "var(--accent-primary)",
            color: "#000",
            border: "none",
            borderRadius: "var(--radius-full)",
            fontSize: "1rem",
            fontWeight: "600",
            cursor:
              isUnlocking || !passphrase.trim() ? "not-allowed" : "pointer",
            opacity: isUnlocking || !passphrase.trim() ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
            transition: "all 0.2s",
          }}
        >
          {isUnlocking ? (
            <>Unlocking...</>
          ) : (
            <>
              <KeyIcon size={18} /> Unlock Album
            </>
          )}
        </button>
      </form>

      <div
        style={{
          marginTop: "var(--space-6)",
          textAlign: "center",
          fontSize: "0.8rem",
          color: "var(--text-tertiary)",
        }}
      >
        Securely encrypted • Zero-knowledge architecture
      </div>
    </div>
  </div>
);

// --- Main Page Component ---

export const PublicSharedAlbumPage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();

  const normalizedShareId = extractUuid(shareId);

  // State
  const [metadata, setMetadata] = useState<SharedAlbumMetadataResponse | null>(
    null,
  );
  const [bundle, setBundle] = useState<EncryptedShareBundleResponse | null>(
    null,
  );
  const [albumShareKey, setAlbumShareKey] = useState<CryptoKey | null>(null);
  const [shareAccessToken, setShareAccessToken] = useState<string | null>(null);
  const [_tokenExpiresAt, setTokenExpiresAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [isHydratingMediaMetadata, setIsHydratingMediaMetadata] =
    useState(false);

  // Key Preparation State
  const [keyPrep, setKeyPrep] = useState<{
    phase: "idle" | "preparing" | "paused" | "done" | "error";
    prepared: number;
    target: number;
    total: number;
    message?: string;
  }>({ phase: "idle", prepared: 0, target: 0, total: 0 });

  // Refs
  const mediaKeysRef = React.useRef<Map<string, CryptoKey>>(new Map());
  const unwrapInFlightRef = React.useRef<Map<string, Promise<CryptoKey>>>(
    new Map(),
  );
  const wrappedMediaKeysRef = React.useRef<
    Map<string, { encryptedKey: string; iv: string }>
  >(new Map());
  const wrappedMediaKeyIdsRef = React.useRef<string[]>([]);
  const keyPrepAbortRef = React.useRef<AbortController | null>(null);
  const sharedPreviewCache = React.useRef<Map<string, string>>(new Map());
  const hasTrackedView = React.useRef(false);

  // --- Core Logic (Unchanged from original implementation for safety) ---

  const ensureMediaKey = async (mediaId: string): Promise<CryptoKey> => {
    const existing = mediaKeysRef.current.get(mediaId);
    if (existing) return existing;
    const inFlight = unwrapInFlightRef.current.get(mediaId);
    if (inFlight) return inFlight;
    if (!albumShareKey) throw new Error("Share not unlocked");
    const wrapped = wrappedMediaKeysRef.current.get(mediaId);
    if (!wrapped) throw new Error("Missing wrapped key for media");

    const promise = (async () => {
      const wrappedKey = base64ToArrayBuffer(wrapped.encryptedKey);
      const iv = base64ToArrayBuffer(wrapped.iv);
      const mediaKey = await unwrapKey(wrappedKey, albumShareKey, iv);
      mediaKeysRef.current.set(mediaId, mediaKey);
      return mediaKey;
    })();
    unwrapInFlightRef.current.set(mediaId, promise);
    try {
      return await promise;
    } finally {
      unwrapInFlightRef.current.delete(mediaId);
    }
  };

  const cancelKeyPreparation = () => {
    try {
      keyPrepAbortRef.current?.abort();
    } finally {
      keyPrepAbortRef.current = null;
      setKeyPrep((prev) =>
        prev.phase === "preparing"
          ? { ...prev, phase: "paused", message: "Paused" }
          : prev,
      );
    }
  };

  const startKeyPreparation = async (options?: {
    prepareAll?: boolean;
    targetCount?: number;
  }) => {
    if (!albumShareKey) return;
    cancelKeyPreparation();
    const controller = new AbortController();
    keyPrepAbortRef.current = controller;

    const ids = wrappedMediaKeyIdsRef.current;
    const total = ids.length;
    const requestedTarget = options?.prepareAll
      ? total
      : Math.max(0, Math.min(options?.targetCount ?? 0, total));
    const target = requestedTarget || Math.min(200, total);

    setKeyPrep((prev) => ({
      phase: "preparing",
      prepared: Math.min(prev.prepared, target),
      target,
      total,
      message: options?.prepareAll
        ? "Preparing keys…"
        : `Preparing first ${target} keys…`,
    }));

    const batchSize = 10;
    try {
      for (let i = 0; i < target; i += batchSize) {
        if (controller.signal.aborted) return;
        const batchIds = ids.slice(i, i + batchSize);
        await Promise.all(
          batchIds.map(async (id) => {
            if (controller.signal.aborted) return;
            if (mediaKeysRef.current.has(id)) return;
            await ensureMediaKey(id);
          }),
        );

        if (controller.signal.aborted) return;
        setKeyPrep((prev) => {
          const nextPrepared = Math.min(target, i + batchIds.length);
          const done = nextPrepared >= target;
          const shouldPauseEarly =
            done && !options?.prepareAll && target < total;
          return {
            ...prev,
            phase: done ? (shouldPauseEarly ? "paused" : "done") : prev.phase,
            prepared: nextPrepared,
            target,
            total,
            message: done
              ? shouldPauseEarly
                ? `Prepared ${nextPrepared}/${total}`
                : "All keys prepared"
              : prev.message,
          };
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setKeyPrep((prev) => ({
          ...prev,
          phase: "error",
          message: err?.message || "Failed to prepare keys",
        }));
      }
    } finally {
      if (keyPrepAbortRef.current === controller)
        keyPrepAbortRef.current = null;
    }
  };

  const applyServerMediaMetadata = (mediaId: string, serverMedia: any) => {
    if (!serverMedia) return;
    setMediaItems((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((item) => {
        if (!item || item.id !== mediaId) return item;
        changed = true;
        return { ...item, ...serverMedia, isShared: true };
      });
      return changed ? next : prev;
    });
  };

  const fetchMetadata = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!normalizedShareId) throw new Error("Invalid share link");
      const metadata = await sharingApi.getMetadata(normalizedShareId);
      setMetadata(metadata);
    } catch (err: any) {
      setError(err.message || "Failed to load shared album");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim() || !metadata) return;
    setIsUnlocking(true);
    setError(null);
    try {
      const bundle = await sharingApi.unlock(metadata.shareId, { passphrase });
      setBundle(bundle);
      if (bundle.shareAccessToken && bundle.tokenExpiresAt) {
        setShareAccessToken(bundle.shareAccessToken);
        setTokenExpiresAt(new Date(bundle.tokenExpiresAt));
      }
      const { albumShareKey } = await unlockShareBundle(passphrase, {
        encryptedAlbumKey: bundle.encryptedAlbumKey,
        iv: bundle.iv,
        kdfParams: bundle.kdfParams,
      });
      setAlbumShareKey(albumShareKey);

      const encryptedKeys = Array.isArray(bundle?.encryptedMediaKeys)
        ? bundle.encryptedMediaKeys
        : [];
      wrappedMediaKeyIdsRef.current = encryptedKeys.map((k) => k.mediaId);
      const wrapped = new Map<string, { encryptedKey: string; iv: string }>();
      for (const item of encryptedKeys) {
        if (item?.mediaId && item?.encryptedKey && item?.iv) {
          wrapped.set(item.mediaId, {
            encryptedKey: item.encryptedKey,
            iv: item.iv,
          });
        }
      }
      wrappedMediaKeysRef.current = wrapped;
      setKeyPrep({
        phase: "idle",
        prepared: 0,
        target: Math.min(200, encryptedKeys.length),
        total: encryptedKeys.length,
      });
      setIsUnlocked(true);
      const items = encryptedKeys.map((item) => ({
        id: item.mediaId,
        type: "PHOTO",
        objectKey: `shared/${metadata.shareId}/${item.mediaId}`,
        contentType: "image/jpeg",
        byteSize: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isTrashed: false,
        isShared: true,
      }));
      setMediaItems(items);
      void startKeyPreparation({ targetCount: Math.min(200, items.length) });
      if (bundle.shareAccessToken && !hasTrackedView.current) {
        hasTrackedView.current = true;
        try {
          await sharingApi.trackView(metadata.shareId, bundle.shareAccessToken);
        } catch {}
      }
    } catch (err: any) {
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        /missing media key IVs/i.test(err.message)
      ) {
        setError(
          "This share is outdated. Please ask the owner to recreate the link.",
        );
      } else {
        setError("Invalid passphrase. Please try again.");
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  // --- Effects ---

  useEffect(() => {
    return () => {
      for (const url of sharedPreviewCache.current.values()) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
      sharedPreviewCache.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!shareId) return;
    if (normalizedShareId && normalizedShareId !== shareId) {
      navigate(`/shared/${normalizedShareId}`, { replace: true });
      return;
    }
    if (!normalizedShareId) {
      setIsLoading(false);
      setError("Invalid share link");
      return;
    }
    fetchMetadata();
  }, [shareId, normalizedShareId]);

  useEffect(() => {
    hasTrackedView.current = false;
  }, [normalizedShareId]);

  useEffect(() => {
    mediaKeysRef.current = new Map();
    unwrapInFlightRef.current = new Map();
    wrappedMediaKeysRef.current = new Map();
    wrappedMediaKeyIdsRef.current = [];
    cancelKeyPreparation();
    setKeyPrep({ phase: "idle", prepared: 0, target: 0, total: 0 });
  }, [normalizedShareId]);

  useEffect(() => {
    if (!isUnlocked || !normalizedShareId || !shareAccessToken) return;
    let cancelled = false;
    setIsHydratingMediaMetadata(true);
    (async () => {
      try {
        let cursor: number | undefined = 0;
        const pageLimit = 200;
        while (!cancelled) {
          const res = await sharingApi.listSharedMediaMetadata(
            normalizedShareId,
            shareAccessToken,
            { cursor, limit: pageLimit },
          );
          if (cancelled) return;
          for (const item of res.items || []) {
            applyServerMediaMetadata(item.id, item);
          }
          if (res.nextCursor == null) break;
          cursor = res.nextCursor;
        }
      } catch (err) {
      } finally {
        if (!cancelled) setIsHydratingMediaMetadata(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isUnlocked, normalizedShareId, shareAccessToken]);

  // --- Media Handlers ---

  const handleMediaClick = async (media: any) => {
    if (!albumShareKey || !bundle || !normalizedShareId || !shareAccessToken) {
      setError("Share session not properly initialized");
      return;
    }
    try {
      const downloadUrl = await sharingApi.getSharedMediaDownloadUrl(
        normalizedShareId,
        media.id,
        shareAccessToken,
        "original",
      );
      if (downloadUrl.media)
        applyServerMediaMetadata(media.id, downloadUrl.media);
      const decryptionKey = await ensureMediaKey(media.id);
      setSelectedMedia({
        ...media,
        ...(downloadUrl.media ? downloadUrl.media : {}),
        shareScopedDownloadUrl: downloadUrl.url,
        decryptionKey,
        ownerUserId:
          (downloadUrl.media as any)?.ownerUserId ??
          (metadata as any)?.ownerUserId,
        shareId: normalizedShareId,
        isShared: true,
      });
      setMediaViewerOpen(true);
    } catch (err: any) {
      setError(`Failed to prepare media: ${err.message}`);
    }
  };

  const getSharedCachedUrl = (mediaId: string) =>
    sharedPreviewCache.current.get(mediaId) || null;

  const loadSharedPreview = async (media: any): Promise<string> => {
    if (!normalizedShareId || !shareAccessToken)
      throw new Error("Missing share session");
    const cached = sharedPreviewCache.current.get(media.id);
    if (cached) return cached;
    const key = await ensureMediaKey(media.id);
    const hasThumbMeta = Boolean(
      media?.thumbUploadedAt &&
      media?.thumbEncMeta?.ivB64 &&
      media?.thumbContentType,
    );
    if (media?.type === "VIDEO" && !hasThumbMeta)
      throw new Error("Video thumbnail not available");

    try {
      const thumb = await sharingApi.getSharedMediaDownloadUrl(
        normalizedShareId,
        media.id,
        shareAccessToken,
        "thumb",
      );
      if (thumb.media) applyServerMediaMetadata(media.id, thumb.media);
      const encMeta = (thumb.media as any)?.thumbEncMeta;
      const mimeType = (thumb.media as any)?.thumbContentType;
      const ownerUserId =
        (thumb.media as any)?.ownerUserId ?? (metadata as any)?.ownerUserId;
      if (!encMeta || !mimeType)
        throw new Error("Thumbnail metadata not available");

      const encV =
        typeof encMeta === "object" && encMeta && "v" in encMeta
          ? (encMeta as { v?: unknown }).v
          : undefined;
      if (encV === 2 && !ownerUserId) {
        throw new Error(
          "Shared media missing ownerUserId (required for v2 decryption)",
        );
      }

      const objectUrl = await fetchAndDecryptShared({
        ownerUserId: ownerUserId ?? "unknown",
        mediaId: media.id,
        downloadUrl: thumb.url,
        decryptionKey: key,
        encMeta,
        variant: "thumb",
        mimeType,
      });
      sharedPreviewCache.current.set(media.id, objectUrl);
      return objectUrl;
    } catch (err: any) {
      const original = await sharingApi.getSharedMediaDownloadUrl(
        normalizedShareId,
        media.id,
        shareAccessToken,
        "original",
      );
      if (original.media) applyServerMediaMetadata(media.id, original.media);
      if ((original.media as any)?.type === "VIDEO") throw err;
      const encMeta = (original.media as any)?.encMeta;
      const mimeType = (original.media as any)?.contentType;
      const ownerUserId =
        (original.media as any)?.ownerUserId ?? (metadata as any)?.ownerUserId;
      if (!encMeta || !mimeType)
        throw new Error("Encryption metadata not available");

      const encV =
        typeof encMeta === "object" && encMeta && "v" in encMeta
          ? (encMeta as { v?: unknown }).v
          : undefined;
      if (encV === 2 && !ownerUserId) {
        throw new Error(
          "Shared media missing ownerUserId (required for v2 decryption)",
        );
      }

      const objectUrl = await fetchAndDecryptShared({
        ownerUserId: ownerUserId ?? "unknown",
        mediaId: media.id,
        downloadUrl: original.url,
        decryptionKey: key,
        encMeta,
        variant: "original",
        mimeType,
      });
      sharedPreviewCache.current.set(media.id, objectUrl);
      return objectUrl;
    }
  };

  // --- Render ---

  if (isLoading) return <LoadingSkeleton />;

  if (error && !metadata)
    return (
      <ErrorView
        title="Access Error"
        message={error}
        onRetry={() => navigate("/")}
      />
    );

  if (!metadata)
    return (
      <ErrorView
        title="Not Found"
        message="The shared album you are looking for does not exist or has been removed."
        onRetry={() => navigate("/")}
      />
    );

  if (metadata.revokedAt)
    return (
      <ErrorView
        title="Access Revoked"
        message="This shared album link has been disabled by the owner."
        onRetry={() => navigate("/")}
      />
    );

  if (new Date(metadata.expiresAt) < new Date())
    return (
      <ErrorView
        title="Link Expired"
        message="This time-limited share link has expired."
        onRetry={() => navigate("/")}
      />
    );

  if (!isUnlocked) {
    return (
      <LockScreen
        metadata={metadata}
        passphrase={passphrase}
        setPassphrase={setPassphrase}
        onUnlock={handleUnlock}
        isUnlocking={isUnlocking}
        error={error}
      />
    );
  }

  // Unlocked View
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(10, 10, 10, 0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border-primary)",
          padding: "var(--space-4) 0",
        }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            padding: "0 var(--space-4)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.25rem",
                fontWeight: "700",
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              {metadata.album.name}
            </h1>
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                marginTop: "2px",
              }}
            >
              {mediaItems.length} items • Read-only{" "}
              {isHydratingMediaMetadata ? "• Syncing..." : ""}
            </div>
          </div>

          {keyPrep.total > 0 && keyPrep.phase !== "done" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
              }}
            >
              <div
                style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}
              >
                {Math.round((keyPrep.prepared / keyPrep.total) * 100)}%
                Decrypted
              </div>
              <div
                style={{
                  width: "100px",
                  height: "4px",
                  background: "var(--bg-elevated)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(keyPrep.prepared / keyPrep.total) * 100}%`,
                    background: "var(--accent-primary)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "var(--space-6) var(--space-4)",
        }}
      >
        {mediaItems.length === 0 ? (
          <div
            style={{
              padding: "var(--space-12)",
              textAlign: "center",
              border: "1px dashed var(--border-primary)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <div
              style={{
                color: "var(--text-tertiary)",
                marginBottom: "var(--space-4)",
              }}
            >
              <CameraIcon size={48} />
            </div>
            <p style={{ color: "var(--text-secondary)" }}>
              No items in this shared album yet.
            </p>
          </div>
        ) : (
          <MediaGrid
            mediaItems={mediaItems}
            onMediaClick={handleMediaClick}
            onTrash={async () => {}}
            emptyMessage=""
            disableTrash={true}
            disableDownload={true}
            loadMediaOverride={loadSharedPreview}
            getCachedUrlOverride={getSharedCachedUrl}
          />
        )}
      </div>

      {selectedMedia && (
        <MediaViewer
          media={selectedMedia}
          open={mediaViewerOpen}
          onClose={() => {
            setMediaViewerOpen(false);
            setSelectedMedia(null);
          }}
          onTrash={async () => {}}
          onRefresh={() => {}}
          disableDownload={true}
          disableTrash={true}
        />
      )}
    </div>
  );
};
