import React, { useState, useEffect, useRef } from "react";
import type { MediaResponse } from "../types/api";
import { useMediaCache } from "../hooks/useMediaCache";
import { isMasterKeyCached } from "../crypto/vaultKey";
import { VaultUnlockModal } from "./VaultUnlockModal";
import {
  formatDuration,
  getCachedVideoDurationSeconds,
  onVideoDurationUpdated,
} from "../utils/videoDurationCache";

interface MediaGridProps {
  mediaItems?: MediaResponse[];
  onMediaClick?: (media: MediaResponse) => void;
  onAddToAlbum?: (mediaId: string) => void;
  onTrash?: (mediaId: string) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (mediaId: string, selected: boolean) => void;
  emptyMessage?: string;
  customActions?: (media: MediaResponse) => React.ReactNode;
  disableTrash?: boolean;
  disableDownload?: boolean;
  loadMediaOverride?: (media: MediaResponse) => Promise<string>;
  getCachedUrlOverride?: (mediaId: string) => string | null;
}

const MediaGridItem: React.FC<{
  media: MediaResponse;
  loadMedia: (media: MediaResponse) => Promise<string>;
  getCachedUrl: (mediaId: string) => string | null;
  isSelected: boolean;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  selectable: boolean;
  onMediaClick?: (media: MediaResponse) => void;
  handleMediaClick: (media: MediaResponse) => void;
  onSelect?: (mediaId: string, selected: boolean) => void;
  onAddToAlbum?: (mediaId: string) => void;
  onTrash?: (mediaId: string) => void;
  customActions?: (media: MediaResponse) => React.ReactNode;
  handleAction: (action: () => void) => void;
  vaultKeyVersion: number;
}> = ({
  media,
  loadMedia,
  getCachedUrl,
  isSelected,
  hoveredId,
  setHoveredId,
  selectable,
  onMediaClick,
  handleMediaClick,
  onSelect,
  onAddToAlbum,
  onTrash,
  customActions,
  handleAction,
  vaultKeyVersion,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [lastLoadErrorAt, setLastLoadErrorAt] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const isHovered = hoveredId === media.id;

  useEffect(() => {
    // If we already have a cached object URL (e.g., user opened viewer), reuse it.
    setImageUrl(getCachedUrl(media.id));
  }, [media.id, getCachedUrl]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsInView(Boolean(entry?.isIntersecting));
      },
      { rootMargin: "200px" },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!isHovered && !isInView) return;
    if (imageUrl) return;
    if (lastLoadErrorAt && Date.now() - lastLoadErrorAt < 5000) return;
    if (!isMasterKeyCached() && !(media as any)?.isShared) return;
    // Avoid fetching full blobs for non-previewable content (e.g. PDFs/docs) in the grid.
    // Show an icon tile unless an encrypted thumbnail is available.
    const isPreviewable =
      media.contentType.startsWith("image/") ||
      media.contentType.startsWith("video/") ||
      hasThumb;
    if (!isPreviewable) return;

    let cancelled = false;
    const t = window.setTimeout(
      () => {
        loadMedia(media)
          .then((url) => {
            if (!cancelled) setImageUrl(url);
          })
          .catch(() => {
            if (!cancelled) setLastLoadErrorAt(Date.now());
          });
      },
      isHovered ? 150 : 0,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [
    isHovered,
    isInView,
    imageUrl,
    lastLoadErrorAt,
    loadMedia,
    media,
    vaultKeyVersion,
  ]);

  const isImage = media.contentType.startsWith("image/");
  const isVideo = media.contentType.startsWith("video/");
  const isPdf =
    media.type === "DOCUMENT" &&
    String(media.contentType || "")
      .toLowerCase()
      .startsWith("application/pdf");

  const getDocumentBadgeLabel = (filename?: string | null): string | null => {
    if (!filename) return null;
    const lower = filename.toLowerCase();

    // Handle common compound extensions first
    if (lower.endsWith(".tar.gz")) return "TAR.GZ";
    if (lower.endsWith(".tar.tgz")) return "TAR.TGZ";

    const dot = lower.lastIndexOf(".");
    if (dot <= 0 || dot === lower.length - 1) return null;
    const ext = lower.slice(dot + 1);
    if (!ext) return null;
    if (ext === "pdf") return "PDF";
    if (ext === "doc" || ext === "docx") return "DOC";
    if (ext === "xls" || ext === "xlsx") return "XLS";
    if (ext === "ppt" || ext === "pptx") return "PPT";
    if (ext === "csv") return "CSV";
    if (ext === "txt") return "TXT";
    if (ext === "md" || ext === "markdown") return "MD";
    if (ext === "json") return "JSON";
    if (ext === "xml") return "XML";
    if (ext === "yml" || ext === "yaml") return "YAML";
    if (ext === "log") return "LOG";
    if (ext === "rtf") return "RTF";
    if (ext === "html" || ext === "htm") return "HTML";
    if (ext === "odt") return "ODT";
    if (ext === "ods") return "ODS";
    if (ext === "odp") return "ODP";
    if (ext === "epub") return "EPUB";
    if (ext === "mobi") return "MOBI";
    if (ext === "eml") return "EML";
    if (ext === "msg") return "MSG";
    if (ext === "zip") return "ZIP";
    if (ext === "7z") return "7Z";
    if (ext === "rar") return "RAR";
    if (ext === "tar") return "TAR";
    if (ext === "gz") return "GZ";
    if (ext === "tgz") return "TGZ";
    return null;
  };

  const docBadgeLabel =
    media.type === "DOCUMENT"
      ? isPdf
        ? "PDF"
        : getDocumentBadgeLabel(media.originalFilename)
      : null;
  const getIvB64 = (encMeta: unknown): string | undefined => {
    if (!encMeta || typeof encMeta !== "object") return undefined;
    const meta = encMeta as { ivB64?: unknown; iv?: unknown };
    if (typeof meta.ivB64 === "string") return meta.ivB64;
    if (typeof meta.iv === "string") return meta.iv;
    return undefined;
  };

  const thumbIvB64 = getIvB64(media.thumbEncMeta);
  const hasThumb = Boolean(
    media.thumbUploadedAt && thumbIvB64 && media.thumbContentType,
  );

  const [videoDurationLabel, setVideoDurationLabel] = useState<string>("");

  useEffect(() => {
    if (!isVideo) {
      setVideoDurationLabel("");
      return;
    }

    const seconds = getCachedVideoDurationSeconds(media.id);
    setVideoDurationLabel(seconds ? formatDuration(seconds) : "");

    return onVideoDurationUpdated((mediaId) => {
      if (mediaId !== media.id) return;
      const updated = getCachedVideoDurationSeconds(media.id);
      setVideoDurationLabel(updated ? formatDuration(updated) : "");
    });
  }, [isVideo, media.id]);

  return (
    <div
      ref={containerRef}
      data-testid="media-card"
      data-media-id={media.id}
      style={{
        position: "relative",
        background: "var(--bg-elevated)",
        border: isSelected
          ? "2px solid var(--accent-primary)"
          : "1px solid transparent",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        cursor: onMediaClick ? "pointer" : "default",
        transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
        aspectRatio: "1",
        boxShadow: isSelected
          ? "0 0 0 2px var(--bg-primary), 0 0 0 4px var(--accent-primary)"
          : isHovered
            ? "var(--shadow-lg)"
            : "var(--shadow-sm)",
        transform: isHovered && !isSelected ? "translateY(-4px)" : "none",
      }}
      onMouseEnter={() => setHoveredId(media.id)}
      onMouseLeave={() => setHoveredId(null)}
      onClick={() => handleMediaClick(media)}
    >
      {selectable && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "8px",
            zIndex: 10,
            opacity: isSelected || isHovered ? 1 : 0,
            transition: "opacity 0.2s ease",
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (onSelect) onSelect(media.id, !isSelected);
          }}
        >
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              backgroundColor: isSelected
                ? "var(--accent-primary)"
                : "rgba(0,0,0,0.5)",
              border: "2px solid white",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {isSelected && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Video play overlay */}
      {isVideo && (
        <div
          aria-label="Play video"
          title="Play"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 8,
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "999px",
              background: "rgba(0,0,0,0.45)",
              border: "1px solid rgba(255,255,255,0.28)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="white"
              style={{ marginLeft: "2px" }}
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {imageUrl ? (
        isVideo && !hasThumb ? (
          <video
            src={imageUrl}
            muted
            playsInline
            preload="metadata"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <img
            src={imageUrl}
            alt={media.originalFilename}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            loading="lazy"
          />
        )
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "var(--bg-tertiary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              color: "var(--text-secondary)",
              opacity: 0.5,
              transition: "transform 0.5s ease",
              transform: isHovered ? "scale(1.05)" : "scale(1)",
            }}
          >
            {isImage ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            ) : isVideo ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect
                  x="2"
                  y="2"
                  width="20"
                  height="20"
                  rx="2.18"
                  ry="2.18"
                ></rect>
                <line x1="7" y1="2" x2="7" y2="22"></line>
                <line x1="17" y1="2" x2="17" y2="22"></line>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <line x1="2" y1="7" x2="7" y2="7"></line>
                <line x1="2" y1="17" x2="7" y2="17"></line>
                <line x1="17" y1="17" x2="22" y2="17"></line>
                <line x1="17" y1="7" x2="22" y2="7"></line>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            )}
          </div>
        </div>
      )}

      {docBadgeLabel && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            zIndex: 9,
            padding: "4px 6px",
            borderRadius: "999px",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "white",
            background: "rgba(0,0,0,0.55)",
            border: "1px solid rgba(255,255,255,0.25)",
            backdropFilter: "blur(6px)",
            lineHeight: 1,
            userSelect: "none",
          }}
          aria-label={docBadgeLabel}
          title={docBadgeLabel}
        >
          {docBadgeLabel}
        </div>
      )}

      {isVideo && (
        <div
          style={{
            position: "absolute",
            bottom: "8px",
            left: "8px",
            zIndex: 9,
            padding: "4px 6px",
            borderRadius: "999px",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "white",
            background: "rgba(0,0,0,0.55)",
            border: "1px solid rgba(255,255,255,0.25)",
            backdropFilter: "blur(6px)",
            lineHeight: 1,
            userSelect: "none",
            pointerEvents: "none",
          }}
          aria-label="Video"
          title="Video"
        >
          {videoDurationLabel ? `VIDEO • ${videoDurationLabel}` : "VIDEO"}
        </div>
      )}

      {/* Gradient Overlay on Hover/Select */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 12px 12px",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          opacity: isHovered || isSelected ? 1 : 0,
          transition: "opacity 0.2s ease",
          height: "50%",
        }}
      >
        <div
          style={{
            color: "white",
            fontWeight: 500,
            fontSize: "0.8125rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            marginBottom: "4px",
          }}
        >
          {media.originalFilename}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: "0.75rem",
              fontWeight: 500,
            }}
          >
            {(media.byteSize / (1024 * 1024)).toFixed(1)} MB
          </span>

          {(onAddToAlbum || onTrash || customActions) && (
            <div style={{ display: "flex", gap: "6px", pointerEvents: "auto" }}>
              {customActions && customActions(media)}
              {onAddToAlbum && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(() => onAddToAlbum(media.id));
                  }}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    borderRadius: "4px",
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    cursor: "pointer",
                    backdropFilter: "blur(4px)",
                  }}
                  title="Add to Album"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
              )}
              {onTrash && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(() => onTrash(media.id));
                  }}
                  style={{
                    background: "rgba(239, 68, 68, 0.6)",
                    border: "none",
                    borderRadius: "4px",
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    cursor: "pointer",
                    backdropFilter: "blur(4px)",
                  }}
                  title="Move to Trash"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const MediaGrid: React.FC<MediaGridProps> = ({
  mediaItems,
  onMediaClick,
  onAddToAlbum,
  onTrash,
  selectable = false,
  selectedIds = new Set(),
  onSelect,
  emptyMessage = "No media found",
  customActions,
  disableTrash = false,
  disableDownload = false,
  loadMediaOverride,
  getCachedUrlOverride,
}) => {
  void disableTrash;
  void disableDownload;

  const [vaultUnlockModalOpen, setVaultUnlockModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [vaultKeyVersion, setVaultKeyVersion] = useState(0);

  const { loadMedia, getCachedUrl } = useMediaCache();
  const loadMediaFn = loadMediaOverride ?? loadMedia;
  const getCachedUrlFn = getCachedUrlOverride ?? getCachedUrl;

  // Prevent thumbnail/download bursts (especially on shared albums where each
  // tile may trigger multiple API calls + a blob download).
  const limiterRef = useRef<{
    active: number;
    queue: Array<() => void>;
  }>({ active: 0, queue: [] });
  const inFlightRef = useRef<Map<string, Promise<string>>>(new Map());

  const maxConcurrentLoads = loadMediaOverride ? 3 : 8;
  const runLimited = (fn: () => Promise<string>) => {
    return new Promise<string>((resolve, reject) => {
      const run = () => {
        limiterRef.current.active += 1;
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            limiterRef.current.active -= 1;
            const next = limiterRef.current.queue.shift();
            if (next) next();
          });
      };

      if (limiterRef.current.active < maxConcurrentLoads) {
        run();
      } else {
        limiterRef.current.queue.push(run);
      }
    });
  };

  const loadMediaLimited = async (media: MediaResponse): Promise<string> => {
    const key = `${media.id}`;
    const existing = inFlightRef.current.get(key);
    if (existing) return existing;

    const promise = runLimited(() => loadMediaFn(media));
    inFlightRef.current.set(key, promise);
    try {
      return await promise;
    } finally {
      inFlightRef.current.delete(key);
    }
  };

  const safeMediaItems: MediaResponse[] = Array.isArray(mediaItems)
    ? mediaItems
    : [];

  const handleMediaClick = (media: MediaResponse) => {
    if (
      !isMasterKeyCached() &&
      !(media as any)?.isShared &&
      !loadMediaOverride
    ) {
      setPendingAction(() => () => {
        if (onMediaClick) onMediaClick(media);
      });
      setVaultUnlockModalOpen(true);
    } else {
      if (onMediaClick) onMediaClick(media);
    }
  };

  const handleAction = (action: () => void) => {
    if (!isMasterKeyCached() && !loadMediaOverride) {
      setPendingAction(() => action);
      setVaultUnlockModalOpen(true);
    } else {
      action();
    }
  };

  const handleUnlockSuccess = () => {
    setVaultUnlockModalOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
    // Trigger grid items to retry loading thumbnails after unlock.
    setVaultKeyVersion((v) => v + 1);
  };

  if (safeMediaItems.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "5rem 2rem",
          color: "var(--text-tertiary)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
          border: "1px dashed var(--border-primary)",
          borderRadius: "var(--radius-xl)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            backgroundColor: "var(--bg-elevated)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-disabled)",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </div>
        <p style={{ fontSize: "1.125rem", fontWeight: 500 }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "var(--space-4)",
          paddingBottom: "var(--space-8)",
        }}
      >
        {safeMediaItems.map((media) => (
          <MediaGridItem
            key={media.id}
            media={media}
            loadMedia={loadMediaLimited}
            getCachedUrl={getCachedUrlFn}
            isSelected={selectedIds.has(media.id)}
            hoveredId={hoveredId}
            setHoveredId={setHoveredId}
            selectable={selectable}
            onMediaClick={onMediaClick}
            handleMediaClick={handleMediaClick}
            onSelect={onSelect}
            onAddToAlbum={onAddToAlbum}
            onTrash={onTrash}
            customActions={customActions}
            handleAction={handleAction}
            vaultKeyVersion={vaultKeyVersion}
          />
        ))}
      </div>

      <VaultUnlockModal
        open={vaultUnlockModalOpen}
        onClose={() => {
          setVaultUnlockModalOpen(false);
          setPendingAction(null);
        }}
        onUnlockSuccess={handleUnlockSuccess}
        title="Unlock Vault"
        message="Your vault needs to be unlocked to perform this action."
      />
    </>
  );
};
