import React, { useState, useEffect, useMemo, useRef } from "react";
import { Modal } from "./Modal";
import type { MediaResponse } from "../types/api";
import { mediaApi } from "../api/media";
import { albumsApi } from "../api/albums";
import {
  fetchAndDecrypt,
  fetchAndDecryptShared,
  downloadDecryptedChunked,
} from "../crypto/decrypt";
import { isMasterKeyCached } from "../crypto/vaultKey";
import { useAuth } from "../app/AuthProvider";
import { VaultUnlockModal } from "./VaultUnlockModal";
import { Loading } from "./Loading";
import { PdfViewer } from "./PdfViewer";
const LazyDocumentViewer = React.lazy(() =>
  import("./DocumentViewer").then((m) => ({ default: m.DocumentViewer })),
);
import { setCachedVideoDurationSeconds } from "../utils/videoDurationCache";

type PreviewDisplay = {
  url: string;
  kind: "image" | "video" | "pdf" | "document";
  isThumb: boolean;
};

type DownloadProgress = {
  done: number;
  total: number;
};

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

interface MediaViewerProps {
  media: MediaResponse & {
    isShared?: boolean;
    shareScopedDownloadUrl?: string;
    decryptionKey?: CryptoKey;
    ownerUserId?: string;
  };
  open: boolean;
  onClose: () => void;
  onTrash?: (id: string) => Promise<void>;
  onDownload?: (id: string) => Promise<void>;
  onRefresh?: () => void;
  disableDownload?: boolean;
  disableTrash?: boolean;
  skipConfirm?: boolean;
  customActions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void | Promise<void>;
    danger?: boolean;
  }>;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  media,
  open,
  onClose,
  onTrash,
  onDownload,
  onRefresh,
  disableDownload = false,
  disableTrash = false,
  skipConfirm = false,
  customActions = [],
  onNext,
  onPrev,
  hasNext = false,
  hasPrev = false,
}) => {
  // Stable lazy component wrapper (avoid re-creating Suspense boundaries).
  const DocumentViewer = useMemo(() => LazyDocumentViewer, []);
  const { user } = useAuth();
  const [display, setDisplay] = useState<PreviewDisplay | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] =
    useState<DownloadProgress | null>(null);
  const [showAddToAlbum, setShowAddToAlbum] = useState(false);
  const [albums, setAlbums] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("");
  const [isAddingToAlbum, setIsAddingToAlbum] = useState(false);
  const [vaultUnlockModalOpen, setVaultUnlockModalOpen] = useState(false);
  const [showShortcutsHint, setShowShortcutsHint] = useState(false);
  const [shortcutsHintNonce, setShortcutsHintNonce] = useState(0);
  const [pendingAction, setPendingAction] = useState<
    (() => void | Promise<void>) | null
  >(null);
  const [controlsVisible, setControlsVisible] = useState(true);

  const loadSeqRef = useRef(0);
  const shortcutsHintTimerRef = useRef<TimeoutHandle | null>(null);
  const controlsTimerRef = useRef<TimeoutHandle | null>(null);

  const objectUrl = display?.url ?? null;

  const isKeyMissingError = (message: string) =>
    message.includes("No decryption key found for media");

  const isVaultLockedError = (message: string) =>
    message.includes("Vault is locked") ||
    message.includes("Master key not cached");

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    return String(err);
  };

  const safeConsoleError = (...args: unknown[]) => {
    globalThis.console?.error(...args);
  };

  const isUserTyping = (): boolean => {
    const active = globalThis.document?.activeElement;
    if (!active) return false;
    const tag = active.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (active instanceof HTMLElement && active.isContentEditable) return true;
    return false;
  };

  const isInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName?.toLowerCase();
    if (tag === "button" || tag === "a" || tag === "input") return true;
    if (tag === "textarea" || tag === "select" || tag === "video") return true;
    if (target.closest("button, a, input, textarea, select")) return true;
    // Opt-out hook for any nested viewer widgets.
    if (target.closest('[data-mv-no-toggle="true"]')) return true;
    return false;
  };

  const closeTopmost = () => {
    if (vaultUnlockModalOpen) {
      setVaultUnlockModalOpen(false);
      setPendingAction(null);
      return;
    }
    if (showAddToAlbum) {
      setShowAddToAlbum(false);
      setSelectedAlbumId("");
      return;
    }
    onClose();
  };

  const showShortcutsHintForMoment = () => {
    setShowShortcutsHint(true);
    setShortcutsHintNonce((n) => n + 1);

    if (shortcutsHintTimerRef.current) {
      globalThis.clearTimeout(shortcutsHintTimerRef.current);
      shortcutsHintTimerRef.current = null;
    }

    shortcutsHintTimerRef.current = globalThis.setTimeout(() => {
      setShowShortcutsHint(false);
      shortcutsHintTimerRef.current = null;
    }, 2400);
  };

  useEffect(() => {
    if (open && media) {
      loadMedia();
      if (showAddToAlbum) {
        loadAlbums();
      }
    }
    return () => {
      loadSeqRef.current += 1;
      if (display?.url) {
        URL.revokeObjectURL(display.url);
      }
      setDisplay(null);
      setIsDownloading(false);
      setDownloadProgress(null);
    };
  }, [open, media, showAddToAlbum]);

  useEffect(() => {
    if (!open) return;

    const handleActivity = () => {
      setControlsVisible(true);
      if (controlsTimerRef.current) {
        globalThis.clearTimeout(controlsTimerRef.current);
      }
      controlsTimerRef.current = globalThis.setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    };

    setControlsVisible(true);
    controlsTimerRef.current = globalThis.setTimeout(
      () => setControlsVisible(false),
      3000,
    );

    // Use pointer events so touch devices can bring controls back.
    globalThis.addEventListener("pointermove", handleActivity);
    globalThis.addEventListener("pointerdown", handleActivity);
    return () => {
      globalThis.removeEventListener("pointermove", handleActivity);
      globalThis.removeEventListener("pointerdown", handleActivity);
      if (controlsTimerRef.current) {
        globalThis.clearTimeout(controlsTimerRef.current);
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (isUserTyping()) return;

      if (e.key === "Escape") {
        e.preventDefault();
        closeTopmost();
        return;
      }

      // Avoid shortcuts while nested modals are open.
      if (showAddToAlbum || vaultUnlockModalOpen) return;

      const key = e.key.toLowerCase();

      // Navigation
      if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault();
        onPrev();
        return;
      }
      if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
        return;
      }

      // D: download
      if (key === "d" && !disableDownload) {
        e.preventDefault();
        handleActionWithVaultCheck(handleDownloadWithFriendlyErrors);
        return;
      }

      // A: add to album
      if (key === "a" && !media.isShared) {
        e.preventDefault();
        handleActionWithVaultCheck(() => {
          setShowAddToAlbum(true);
          loadAlbums();
        });
        return;
      }

      // T/Delete/Backspace: trash
      if (
        (key === "t" || e.key === "Delete" || e.key === "Backspace") &&
        !disableTrash
      ) {
        e.preventDefault();
        handleActionWithVaultCheck(handleMoveToTrash);
        return;
      }

      // R: retry (when error)
      if (key === "r" && error) {
        e.preventDefault();
        void loadMedia();
      }

      // ?: show shortcuts hint
      if (e.key === "?") {
        e.preventDefault();
        showShortcutsHintForMoment();
      }
    };

    globalThis.addEventListener("keydown", onKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", onKeyDown);
    };
  }, [
    open,
    disableDownload,
    disableTrash,
    error,
    media.isShared,
    showAddToAlbum,
    vaultUnlockModalOpen,
    onNext,
    onPrev,
  ]);

  useEffect(() => {
    if (!open) return;

    showShortcutsHintForMoment();

    return () => {
      if (shortcutsHintTimerRef.current) {
        globalThis.clearTimeout(shortcutsHintTimerRef.current);
        shortcutsHintTimerRef.current = null;
      }
    };
  }, [open]);

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const idx = Math.min(
      units.length - 1,
      Math.floor(Math.log(bytes) / Math.log(1024)),
    );
    const value = bytes / Math.pow(1024, idx);
    return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
  };

  const setDisplayAndRevokePrevious = (next: PreviewDisplay | null) => {
    setDisplay((prev) => {
      if (prev?.url && prev.url !== next?.url) {
        try {
          URL.revokeObjectURL(prev.url);
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const getOriginalDisplayKind = (
    contentType: string,
    mediaType: MediaResponse["type"],
  ): PreviewDisplay["kind"] => {
    const ct = String(contentType || "").toLowerCase();
    const isPdf =
      ct.startsWith("application/pdf") ||
      (typeof media?.originalFilename === "string" &&
        media.originalFilename.toLowerCase().endsWith(".pdf"));
    if (isPdf) return "pdf";
    if (mediaType === "VIDEO" || ct.startsWith("video/")) return "video";
    if (mediaType === "DOCUMENT") return "document";
    return "image";
  };

  const normalizeContentType = (contentType: string): string =>
    (String(contentType || "").split(";")[0] ?? "").trim().toLowerCase();

  const getFileExtLower = (name?: string | null): string => {
    const n = String(name || "");
    const ext = n.split(".").pop();
    return ext ? ext.toLowerCase() : "";
  };

  const isTier1Document = (contentType: string, filename?: string | null) => {
    const ct = normalizeContentType(contentType);
    const ext = getFileExtLower(filename);

    if (ct === "application/pdf" || ext === "pdf") return true;
    if (ct === "application/msword" || ext === "doc") return true;
    if (
      ct ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      return true;
    }
    if (ct === "application/vnd.ms-excel" || ext === "xls") return true;
    if (
      ct ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      ext === "xlsx"
    ) {
      return true;
    }
    if (ct === "application/vnd.ms-powerpoint" || ext === "ppt") return true;
    if (
      ct ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      ext === "pptx"
    ) {
      return true;
    }
    if (ct === "text/plain" || ext === "txt") return true;
    if (ct === "text/csv" || ext === "csv") return true;
    if (ct === "application/zip" || ext === "zip") return true;

    return false;
  };

  const isPreviewSupportedDocument = (
    contentType: string,
    filename?: string | null,
  ): boolean => {
    const ct = normalizeContentType(contentType);
    const ext = getFileExtLower(filename);

    // Tier-1 + previewable
    if (ct === "application/pdf" || ext === "pdf") return true;
    if (
      ct ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      return true;
    }
    if (
      ct ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      ext === "xlsx"
    ) {
      return true;
    }
    if (
      ct ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      ext === "pptx"
    ) {
      return true;
    }
    if (ct === "text/plain" || ext === "txt" || ext === "log") return true;
    if (ct === "text/csv" || ext === "csv") return true;
    if (ct === "application/zip" || ext === "zip") return true;

    // Tier-2 (common in tech/teams)
    if (ct === "text/markdown" || ext === "md" || ext === "markdown")
      return true;
    if (ct === "text/html" || ext === "html" || ext === "htm") return true;
    if (ct === "application/rtf" || ct === "text/rtf" || ext === "rtf")
      return true;
    if (ct === "application/json" || ext === "json") return true;
    if (ct === "application/xml" || ct === "text/xml" || ext === "xml")
      return true;
    if (
      ct === "application/yaml" ||
      ct === "text/yaml" ||
      ext === "yml" ||
      ext === "yaml"
    ) {
      return true;
    }

    // Tier-3: thumbnails only (download-only; no in-app preview)
    if (ct === "application/vnd.oasis.opendocument.text" || ext === "odt")
      return false;
    if (
      ct === "application/vnd.oasis.opendocument.spreadsheet" ||
      ext === "ods"
    )
      return false;
    if (
      ct === "application/vnd.oasis.opendocument.presentation" ||
      ext === "odp"
    )
      return false;

    // Tier-4: download-only (no in-app preview)
    if (ct === "application/epub+zip" || ext === "epub") return false;

    // Legacy Office (.doc/.xls/.ppt) is intentionally not previewed.
    return false;
  };

  const sniffPdfFromObjectUrl = async (url: string): Promise<boolean> => {
    try {
      const res = await globalThis.fetch(url);
      const blob = await res.blob();
      const head = await blob.slice(0, 5).arrayBuffer();
      const bytes = new Uint8Array(head);
      // "%PDF-"
      return (
        bytes.length >= 5 &&
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46 &&
        bytes[4] === 0x2d
      );
    } catch {
      return false;
    }
  };

  const loadOriginalPreview = async (loadSeq: number) => {
    const userId = user?.id;
    if (!userId) throw new Error("Missing user context");
    if (!media?.encMeta) throw new Error("Missing encryption metadata");
    const signedOriginal = await mediaApi.getDownloadUrl(media.id, "original");
    const url = await fetchAndDecrypt({
      userId,
      mediaId: media.id,
      downloadUrl: signedOriginal.url,
      encMeta: media.encMeta,
      variant: "original",
      mimeType: media.contentType,
    });
    if (loadSeq !== loadSeqRef.current) {
      URL.revokeObjectURL(url);
      return;
    }

    let kind = getOriginalDisplayKind(media.contentType, media.type);
    if (kind === "image") {
      const isPdfByBytes = await sniffPdfFromObjectUrl(url);
      if (isPdfByBytes) kind = "pdf";
    }

    setDisplayAndRevokePrevious({
      url,
      kind,
      isThumb: false,
    });
  };

  const loadMedia = async () => {
    if (!media) return;

    const getIvB64 = (encMeta: unknown): string | undefined => {
      if (!encMeta || typeof encMeta !== "object") return undefined;
      const meta = encMeta as { ivB64?: unknown; iv?: unknown };
      if (typeof meta.ivB64 === "string") return meta.ivB64;
      if (typeof meta.iv === "string") return meta.iv;
      return undefined;
    };

    // Check if vault is unlocked (only for non-shared media)
    if (!media.isShared && !isMasterKeyCached()) {
      // Prefer the dedicated Vault Locked UI over a generic error state.
      setError(null);
      return;
    }

    const loadSeq = (loadSeqRef.current += 1);
    setIsLoading(!display);
    setError(null);

    const thumbIvB64 = getIvB64(media.thumbEncMeta);
    const hasThumb = Boolean(
      media.thumbUploadedAt && thumbIvB64 && media.thumbContentType,
    );

    const isPdfByMetadata =
      media.contentType.toLowerCase().startsWith("application/pdf") ||
      (typeof media.originalFilename === "string" &&
        media.originalFilename.toLowerCase().endsWith(".pdf"));

    const isPreviewSupportedDocByMetadata =
      media.type === "DOCUMENT" &&
      isPreviewSupportedDocument(media.contentType, media.originalFilename);

    const normalizedCt = normalizeContentType(media.contentType);

    const isPreviewableContentType =
      normalizedCt.startsWith("image/") ||
      normalizedCt.startsWith("video/") ||
      isPdfByMetadata ||
      isPreviewSupportedDocByMetadata;

    // For non-previewable items (e.g., PDFs/docs), don't auto-download/decrypt on open.
    // The user can still use the Download action.
    if (!isPreviewableContentType && !hasThumb) {
      setDisplayAndRevokePrevious(null);
      setIsLoading(false);
      return;
    }

    try {
      if (
        media.isShared &&
        media.shareScopedDownloadUrl &&
        media.decryptionKey
      ) {
        if (!media.encMeta) {
          throw new Error("Missing encryption metadata for shared media");
        }

        const encV =
          typeof media.encMeta === "object" &&
          media.encMeta &&
          "v" in media.encMeta
            ? (media.encMeta as { v?: unknown }).v
            : undefined;
        if (encV === 2 && !media.ownerUserId) {
          throw new Error(
            "Shared media missing ownerUserId (required for v2 decryption)",
          );
        }

        const ownerUserId = media.ownerUserId ?? user?.id ?? "unknown";
        // For shared media, use share-scoped download URL and provided decryption key
        const url = await fetchAndDecryptShared({
          ownerUserId,
          mediaId: media.id,
          downloadUrl: media.shareScopedDownloadUrl,
          decryptionKey: media.decryptionKey,
          encMeta: media.encMeta,
          variant: "original",
          mimeType: media.contentType,
        });
        if (loadSeq !== loadSeqRef.current) {
          URL.revokeObjectURL(url);
          return;
        }
        setDisplayAndRevokePrevious({
          url,
          kind: getOriginalDisplayKind(media.contentType, media.type),
          isThumb: false,
        });
      } else {
        // For regular media, prefer thumbnail variant first (fast preview) then upgrade to original.
        // For PDFs, avoid getting stuck rendering the (image) thumbnail; load original directly.
        const shouldTryThumbFirst =
          hasThumb &&
          !isPdfByMetadata &&
          (!display || (display && display.isThumb));

        if (shouldTryThumbFirst) {
          try {
            const userId = user?.id;
            if (!userId) throw new Error("Missing user context");

            const signedThumb = await mediaApi.getDownloadUrl(
              media.id,
              "thumb",
            );
            if (!thumbIvB64 || !media.thumbContentType) {
              throw new Error("Missing thumbnail encryption metadata");
            }
            const thumbUrl = await fetchAndDecrypt({
              userId,
              mediaId: media.id,
              downloadUrl: signedThumb.url,
              encMeta: media.thumbEncMeta,
              variant: "thumb",
              mimeType: media.thumbContentType,
            });

            if (loadSeq !== loadSeqRef.current) {
              URL.revokeObjectURL(thumbUrl);
              return;
            }

            // Always render thumb as an image, even for videos.
            setDisplayAndRevokePrevious({
              url: thumbUrl,
              kind: "image",
              isThumb: true,
            });

            setIsLoading(false);

            // Upgrade to original in the background only when preview is supported.
            // Tier-2 documents are stored securely but may not be previewable.
            if (isPreviewableContentType) {
              void loadOriginalPreview(loadSeq).catch((e) => {
                // For documents, thumb-only is confusing; surface the error.
                if (media.type === "DOCUMENT") {
                  const message = e instanceof Error ? e.message : String(e);
                  setError(message || "Failed to load media");
                }
                // Otherwise ignore upgrade failures; thumb preview is still useful.
              });
            }
            return;
          } catch {
            // If thumb load fails, fall back to original.
          }
        }

        // Original-only fallback.
        await loadOriginalPreview(loadSeq);
      }
    } catch (err: unknown) {
      safeConsoleError("Failed to load media:", err);
      setError(getErrorMessage(err) || "Failed to load media");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAlbums = async () => {
    setIsLoadingAlbums(true);
    try {
      const response = await albumsApi.list({ limit: 50 });
      setAlbums(
        Array.isArray(response?.items)
          ? response.items.map((album) => ({ id: album.id, name: album.name }))
          : [],
      );
    } catch (err: unknown) {
      safeConsoleError("Failed to load albums:", err);
      setError("Failed to load albums");
    } finally {
      setIsLoadingAlbums(false);
    }
  };

  const handleActionWithVaultCheck = (action: () => void | Promise<void>) => {
    if (!isMasterKeyCached()) {
      setPendingAction(() => action);
      setVaultUnlockModalOpen(true);
      return;
    }
    Promise.resolve(action()).catch((err: unknown) => {
      safeConsoleError("Action failed:", err);
      setError(getErrorMessage(err) || "Action failed");
    });
  };

  const handleUnlockSuccess = () => {
    setVaultUnlockModalOpen(false);
    if (pendingAction) {
      Promise.resolve(pendingAction()).catch((err: unknown) => {
        safeConsoleError("Action failed:", err);
        setError(getErrorMessage(err) || "Action failed");
      });
      setPendingAction(null);
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadProgress(null);
    if (onDownload) {
      await onDownload(media.id);
    } else {
      // Chunked (large-file) download path: range-fetch + decrypt per chunk, write to disk.
      if (
        media.encAlgo === "aes-256-gcm-chunked-v1" ||
        media.encAlgo === "aes-256-gcm-chunked-v2"
      ) {
        const filename =
          media.originalFilename || `media-${media.id.slice(0, 8)}`;

        if (
          media.isShared &&
          media.shareScopedDownloadUrl &&
          media.decryptionKey
        ) {
          const encV =
            typeof media.encMeta === "object" &&
            media.encMeta &&
            "v" in media.encMeta
              ? (media.encMeta as { v?: unknown }).v
              : undefined;
          if (encV === 2 && !media.ownerUserId) {
            throw new Error(
              "Shared media missing ownerUserId (required for v2 decryption)",
            );
          }

          const ownerUserId = media.ownerUserId ?? user?.id ?? "unknown";
          await downloadDecryptedChunked({
            userId: ownerUserId,
            mediaId: media.id,
            downloadUrl: media.shareScopedDownloadUrl,
            encAlgo: media.encAlgo,
            encMeta: media.encMeta,
            filename,
            mimeType: media.contentType,
            decryptionKey: media.decryptionKey,
            onProgress: (done, total) => setDownloadProgress({ done, total }),
          });
          return;
        }

        const userId = user?.id;
        if (!userId) throw new Error("Missing user context");

        const signedOriginal = await mediaApi.getDownloadUrl(
          media.id,
          "original",
        );
        await downloadDecryptedChunked({
          userId,
          mediaId: media.id,
          downloadUrl: signedOriginal.url,
          encAlgo: media.encAlgo,
          encMeta: media.encMeta,
          filename,
          mimeType: media.contentType,
          onProgress: (done, total) => setDownloadProgress({ done, total }),
        });
        return;
      }

      // Default download behavior
      let downloadUrl: string | null = display?.url ?? objectUrl;

      const fetchOriginalForDownload = async (): Promise<string> => {
        const encMeta = media.encMeta;
        if (!encMeta) throw new Error("Missing encryption metadata");

        if (
          media.isShared &&
          media.shareScopedDownloadUrl &&
          media.decryptionKey
        ) {
          const encV =
            typeof encMeta === "object" && encMeta && "v" in encMeta
              ? (encMeta as { v?: unknown }).v
              : undefined;
          if (encV === 2 && !media.ownerUserId) {
            throw new Error(
              "Shared media missing ownerUserId (required for v2 decryption)",
            );
          }

          const ownerUserId = media.ownerUserId ?? user?.id ?? "unknown";

          return await fetchAndDecryptShared({
            ownerUserId,
            mediaId: media.id,
            downloadUrl: media.shareScopedDownloadUrl,
            decryptionKey: media.decryptionKey,
            encMeta,
            variant: "original",
            mimeType: media.contentType,
          });
        }

        const userId = user?.id;
        if (!userId) throw new Error("Missing user context");

        const signedOriginal = await mediaApi.getDownloadUrl(
          media.id,
          "original",
        );
        return await fetchAndDecrypt({
          userId,
          mediaId: media.id,
          downloadUrl: signedOriginal.url,
          encMeta,
          variant: "original",
          mimeType: media.contentType,
        });
      };

      // If we're currently showing a thumbnail, always download the original file.
      if (display?.isThumb) {
        try {
          downloadUrl = await fetchOriginalForDownload();
        } catch {
          // If original download fails, fall back to current preview.
        }
      }

      // For documents (and any media where we didn't auto-load a preview), fetch+decrypt on demand.
      if (!downloadUrl) {
        downloadUrl = await fetchOriginalForDownload();
      }

      if (!downloadUrl) return;
      const doc = globalThis.document;
      if (!doc) {
        throw new Error("Document API unavailable");
      }

      const a = doc.createElement("a");
      a.href = downloadUrl;
      a.download = media.originalFilename || `media-${media.id.slice(0, 8)}`;
      doc.body.appendChild(a);
      a.click();
      doc.body.removeChild(a);

      // If we created a throwaway URL just for download, revoke it.
      if (!objectUrl && downloadUrl) {
        globalThis.setTimeout(() => {
          try {
            if (downloadUrl) {
              URL.revokeObjectURL(downloadUrl);
            }
          } catch (revokeErr) {
            void revokeErr;
          }
        }, 30_000);
      }
    }
  };

  const handleDownloadWithFriendlyErrors = async () => {
    try {
      await handleDownload();
    } catch (e: unknown) {
      // User cancel from the file picker is not an error we should surface.
      const maybeName =
        typeof e === "object" && e && "name" in e
          ? (e as { name?: unknown }).name
          : undefined;
      const name = String(maybeName || "");
      if (name === "AbortError") return;
      throw e;
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAddToAlbum = async () => {
    if (!selectedAlbumId) {
      globalThis.alert?.("Please select an album");
      return;
    }

    setIsAddingToAlbum(true);
    try {
      await albumsApi.addItems(selectedAlbumId, [media.id]);
      globalThis.alert?.("Media added to album successfully!");
      setShowAddToAlbum(false);
      setSelectedAlbumId("");
    } catch (err: unknown) {
      globalThis.alert?.(`Failed to add to album: ${getErrorMessage(err)}`);
    } finally {
      setIsAddingToAlbum(false);
    }
  };

  const handleMoveToTrash = async () => {
    if (
      !skipConfirm &&
      !(
        globalThis.confirm?.(
          "Are you sure you want to move this media to trash?",
        ) ?? false
      )
    ) {
      return;
    }

    try {
      if (onTrash) {
        await onTrash(media.id);
      } else {
        await mediaApi.trash(media.id);
      }

      if (!skipConfirm) {
        globalThis.alert?.("Media moved to trash");
        if (onRefresh) {
          onRefresh();
        }
        onClose();
      }
    } catch (err: unknown) {
      globalThis.alert?.(`Failed to trash media: ${getErrorMessage(err)}`);
    }
  };

  if (!open) return null;

  const getSupportTierLabel = (
    contentType: string,
    filename?: string | null,
  ): string => {
    const ct = normalizeContentType(contentType);
    const ext = getFileExtLower(filename);

    if (isTier1Document(ct, filename)) return "Tier-1";

    if (ct === "text/markdown" || ext === "md" || ext === "markdown")
      return "Tier-2";
    if (ct === "text/html" || ext === "html" || ext === "htm") return "Tier-2";
    if (ct === "application/rtf" || ct === "text/rtf" || ext === "rtf")
      return "Tier-2";
    if (ct === "application/json" || ext === "json") return "Tier-2";
    if (ct === "application/xml" || ct === "text/xml" || ext === "xml")
      return "Tier-2";
    if (
      ct === "application/yaml" ||
      ct === "text/yaml" ||
      ext === "yml" ||
      ext === "yaml"
    ) {
      return "Tier-2";
    }
    if (ext === "log") return "Tier-2";

    if (
      ct.startsWith("application/vnd.oasis.opendocument") ||
      ext === "odt" ||
      ext === "ods" ||
      ext === "odp"
    ) {
      return "Tier-3";
    }

    if (
      ct === "application/epub+zip" ||
      ext === "epub" ||
      ext === "mobi" ||
      ct === "message/rfc822" ||
      ext === "eml" ||
      ext === "msg" ||
      ext === "7z" ||
      ext === "rar" ||
      ext === "tar" ||
      ext === "gz" ||
      ext === "tgz"
    ) {
      return "Tier-4";
    }

    // Tier-2 uploads allow unknown formats; treat as Tier-2 (download-only).
    return "Tier-2";
  };

  const isVaultLocked = !media?.isShared && !isMasterKeyCached();
  const shouldOfferUnlock =
    !media?.isShared &&
    (isVaultLocked || !!(error && isVaultLockedError(error)));
  const showKeyMissingHint = !!(error && isKeyMissingError(error));

  const isPreviewSupportedDocForUi =
    media.type === "DOCUMENT" &&
    isPreviewSupportedDocument(media.contentType, media.originalFilename);
  const showTier2Hint =
    media.type === "DOCUMENT" &&
    !isPreviewSupportedDocForUi &&
    (Boolean(display?.isThumb) || !objectUrl);

  const tierLabelForUi =
    media.type === "DOCUMENT"
      ? getSupportTierLabel(media.contentType, media.originalFilename)
      : null;

  return (
    <Modal open={open} onClose={onClose} variant="media">
      <style>
        {`
          @media (prefers-reduced-motion: no-preference) {
            .mv-fade-in { animation: mvFadeIn 140ms ease-out; }
            @keyframes mvFadeIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }

            .mv-hint { animation: mvHintPop 2400ms ease-out forwards; }
            @keyframes mvHintPop {
              0% { opacity: 0; transform: translateY(6px) scale(0.985); }
              10% { opacity: 1; transform: translateY(0) scale(1); }
              85% { opacity: 1; transform: translateY(0) scale(1); }
              100% { opacity: 0; transform: translateY(4px) scale(0.99); }
            }
          }

          .mv-topbar { -webkit-user-select: none; user-select: none; }
          .mv-title { max-width: min(72vw, 900px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

          .mv-iconbtn {
            transition: background-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
            outline: none;
          }
          .mv-iconbtn:hover { background: rgba(255, 255, 255, 0.28) !important; }
          .mv-iconbtn:active { transform: translateY(1px); }
          .mv-iconbtn:focus-visible {
            box-shadow: 0 0 0 2px rgba(255,255,255,0.35), 0 0 0 6px rgba(120, 168, 255, 0.35);
          }

          .mv-toolbar {
            transition: background-color 140ms ease, transform 140ms ease;
          }
          .mv-toolbtn {
            transition: background-color 120ms ease, transform 120ms ease;
            outline: none;
          }
          .mv-toolbtn:hover { background: rgba(255, 255, 255, 0.08) !important; }
          .mv-toolbtn:active { transform: translateY(1px); }
          .mv-toolbtn:focus-visible {
            box-shadow: 0 0 0 2px rgba(255,255,255,0.22), 0 0 0 6px rgba(120, 168, 255, 0.30);
          }

          .mv-hint {
            pointer-events: none;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(20, 20, 20, 0.58);
            backdrop-filter: blur(12px);
            box-shadow: 0 10px 40px rgba(0,0,0,0.35);
            color: rgba(255,255,255,0.92);
            font-size: 12px;
            letter-spacing: 0.2px;
          }

          .mv-kbd {
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }

          .mv-key {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 22px;
            height: 22px;
            padding: 0 7px;
            border-radius: 7px;
            border: 1px solid rgba(255,255,255,0.16);
            background: rgba(255,255,255,0.10);
            color: rgba(255,255,255,0.95);
            font-weight: 650;
            font-size: 12px;
          }

          .mv-sep { opacity: 0.55; }
        `}
      </style>

      {showShortcutsHint && !showAddToAlbum && !vaultUnlockModalOpen && (
        <div
          key={shortcutsHintNonce}
          className="mv-hint"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.25rem)",
            zIndex: 21,
            maxWidth: "min(92vw, 900px)",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ opacity: 0.82 }}>Shortcuts</span>
          <span className="mv-sep">•</span>

          {!disableDownload && (
            <span className="mv-kbd">
              <span className="mv-key">D</span>
              <span>Download</span>
            </span>
          )}

          {!media.isShared && (
            <>
              <span className="mv-sep">•</span>
              <span className="mv-kbd">
                <span className="mv-key">A</span>
                <span>Add</span>
              </span>
            </>
          )}

          {!disableTrash && (
            <>
              <span className="mv-sep">•</span>
              <span className="mv-kbd">
                <span className="mv-key">T</span>
                <span>Trash</span>
              </span>
            </>
          )}

          <span className="mv-sep">•</span>
          <span className="mv-kbd">
            <span className="mv-key">Esc</span>
            <span>Close</span>
          </span>
        </div>
      )}

      {(hasPrev || onPrev) && (
        <button
          className="mv-nav-btn mv-prev"
          onClick={(e) => {
            e.stopPropagation();
            onPrev?.();
          }}
          disabled={!hasPrev && !onPrev}
          style={{
            position: "absolute",
            top: "50%",
            left: "calc(env(safe-area-inset-left, 0px) + 1rem)",
            transform: "translateY(-50%)",
            zIndex: 25,
            background: "rgba(255, 255, 255, 0.12)",
            border: "none",
            borderRadius: "50%",
            width: "52px",
            height: "52px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "white",
            backdropFilter: "blur(10px)",
            opacity: controlsVisible ? 1 : 0,
            transition: "opacity 0.3s ease, background 0.2s",
            pointerEvents: controlsVisible ? "auto" : "none",
            boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.2)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
          }
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      )}

      {(hasNext || onNext) && (
        <button
          className="mv-nav-btn mv-next"
          onClick={(e) => {
            e.stopPropagation();
            onNext?.();
          }}
          disabled={!hasNext && !onNext}
          style={{
            position: "absolute",
            top: "50%",
            right: "calc(env(safe-area-inset-right, 0px) + 1rem)",
            transform: "translateY(-50%)",
            zIndex: 25,
            background: "rgba(255, 255, 255, 0.12)",
            border: "none",
            borderRadius: "50%",
            width: "52px",
            height: "52px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "white",
            backdropFilter: "blur(10px)",
            opacity: controlsVisible ? 1 : 0,
            transition: "opacity 0.3s ease, background 0.2s",
            pointerEvents: controlsVisible ? "auto" : "none",
            boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.2)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
          }
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      )}

      <div
        className="mv-topbar"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding:
            "calc(env(safe-area-inset-top, 0px) + 0.75rem) 1rem 0.75rem 1rem",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.75), rgba(0,0,0,0.15), transparent)",
          zIndex: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          pointerEvents: "none",
          opacity: controlsVisible ? 1 : 0,
          transition: "opacity 0.3s ease-in-out",
        }}
      >
        <div
          style={{
            pointerEvents: controlsVisible ? "auto" : "none",
            color: "white",
            textShadow: "0 1px 4px rgba(0,0,0,0.45)",
            padding: "0.6rem 0.75rem",
            borderRadius: "14px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(15, 15, 15, 0.42)",
            backdropFilter: "blur(14px)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
          }}
        >
          <h3
            className="mv-title"
            style={{ margin: 0, fontSize: "1rem", fontWeight: 650 }}
            title={media.originalFilename || "Untitled"}
          >
            {media.originalFilename || "Untitled"}
          </h3>
          <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.82 }}>
            {formatBytes(media.byteSize)} •{" "}
            {new Date(media.createdAt).toLocaleDateString()}
            {tierLabelForUi && (
              <span style={{ marginLeft: "0.5rem", opacity: 0.72 }}>
                ({tierLabelForUi})
              </span>
            )}
            {media.isShared && (
              <span
                style={{
                  marginLeft: "0.5rem",
                  padding: "0.1rem 0.45rem",
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  fontSize: "0.75rem",
                }}
              >
                Shared
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={closeTopmost}
          aria-label="Close"
          className="mv-iconbtn"
          style={{
            pointerEvents: controlsVisible ? "auto" : "none",
            background: "rgba(255,255,255,0.18)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "999px",
            height: "38px",
            padding: "0 0.85rem",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            cursor: "pointer",
            backdropFilter: "blur(14px)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
          }}
          title="Close (Esc)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Subtle premium vignette */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "radial-gradient(1200px 700px at 50% 45%, rgba(255,255,255,0.06), transparent 60%), radial-gradient(900px 600px at 18% 70%, rgba(0,212,255,0.06), transparent 60%), radial-gradient(900px 600px at 82% 70%, rgba(124,58,237,0.05), transparent 60%), radial-gradient(1000px 700px at 50% 110%, rgba(0,0,0,0.55), transparent 60%)",
          opacity: 0.95,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 5,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 5.25rem) calc(env(safe-area-inset-right, 0px) + 1rem) calc(env(safe-area-inset-bottom, 0px) + 7.25rem) calc(env(safe-area-inset-left, 0px) + 1rem)",
          overflow: "hidden",
          touchAction: "manipulation",
        }}
        onClick={(e) => {
          if (!controlsVisible) {
            setControlsVisible(true);
            return;
          }
          if (isInteractiveTarget(e.target)) return;
          // Background click toggles chrome.
          if (e.currentTarget === e.target) {
            setControlsVisible(false);
          }
        }}
      >
        {isLoading ? (
          <div
            className="mv-fade-in"
            style={{
              color: "white",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <Loading size="large" />
            <p>Decrypting media...</p>
          </div>
        ) : error ? (
          <div
            style={{ textAlign: "center", color: "#ff6b6b", maxWidth: "400px" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: "1rem" }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h4 style={{ marginBottom: "0.5rem", color: "white" }}>
              Unable to load media
            </h4>
            <p style={{ color: "rgba(255,255,255,0.7)" }}>{error}</p>
            {showKeyMissingHint && (
              <p
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: "0.85rem",
                  marginTop: "0.5rem",
                }}
              >
                This device doesn’t have the encrypted key needed to decrypt
                this item.
              </p>
            )}
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "center",
                marginTop: "1rem",
              }}
            >
              {shouldOfferUnlock && (
                <button
                  onClick={() => {
                    setPendingAction(() => loadMedia);
                    setVaultUnlockModalOpen(true);
                  }}
                  className="btn btn-primary"
                >
                  Unlock Vault
                </button>
              )}
              <button onClick={loadMedia} className="btn btn-secondary">
                Retry
              </button>
            </div>
          </div>
        ) : isVaultLocked ? (
          <div style={{ textAlign: "center", color: "white" }}>
            <div
              style={{ marginBottom: "1rem", color: "rgba(255,255,255,0.8)" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h4 style={{ marginBottom: "0.5rem" }}>Vault Locked</h4>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.875rem" }}>
              Unlock your vault to view this media.
            </p>
            <button
              onClick={() => {
                setPendingAction(() => loadMedia);
                setVaultUnlockModalOpen(true);
              }}
              className="btn btn-primary"
              style={{ marginTop: "1rem" }}
            >
              Unlock Vault
            </button>
          </div>
        ) : objectUrl ? (
          display?.kind === "image" ? (
            <img
              src={objectUrl}
              alt={media.originalFilename || "Media"}
              className="mv-fade-in"
              style={{
                maxWidth: "min(100%, 1200px)",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: "12px",
                boxShadow:
                  "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07)",
              }}
              onContextMenu={(e) => {
                if (disableDownload) {
                  e.preventDefault();
                }
              }}
            />
          ) : display?.kind === "pdf" ? (
            <div
              className="mv-fade-in"
              style={{
                width: "min(100%, 1100px)",
                height: "100%",
                background: "rgba(255,255,255,0.98)",
                borderRadius: "14px",
                overflow: "hidden",
                boxShadow:
                  "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.12)",
              }}
            >
              <PdfViewer
                src={objectUrl}
                title={media.originalFilename || "PDF"}
                height="100%"
              />
            </div>
          ) : display?.kind === "document" ? (
            <div
              className="mv-fade-in"
              style={{
                width: "min(100%, 1100px)",
                height: "100%",
                background: "rgba(255,255,255,0.98)",
                borderRadius: "14px",
                overflow: "hidden",
                boxShadow:
                  "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.12)",
              }}
            >
              <React.Suspense
                fallback={<Loading message="Loading preview..." />}
              >
                <DocumentViewer
                  src={objectUrl}
                  contentType={media.contentType}
                  filename={media.originalFilename || undefined}
                  height="100%"
                />
              </React.Suspense>
            </div>
          ) : (
            <video
              src={objectUrl}
              controls
              autoPlay
              className="mv-fade-in"
              style={{
                maxWidth: "min(100%, 1200px)",
                maxHeight: "100%",
                borderRadius: "12px",
                boxShadow:
                  "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07)",
              }}
              onLoadedMetadata={(e) => {
                const seconds = e.currentTarget.duration;
                if (Number.isFinite(seconds) && seconds > 0) {
                  setCachedVideoDurationSeconds(media.id, seconds);
                }
              }}
              onContextMenu={(e) => {
                if (disableDownload) {
                  e.preventDefault();
                }
              }}
            />
          )
        ) : (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
            <p>Preview unavailable</p>
            {showTier2Hint && (
              <p style={{ fontSize: "0.8rem" }}>
                This file type can be downloaded but not previewed.
              </p>
            )}
          </div>
        )}
      </div>

      <div
        className="mv-toolbar"
        style={{
          position: "absolute",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
          display: "flex",
          gap: "1rem",
          background: "rgba(16, 16, 16, 0.52)",
          backdropFilter: "blur(12px)",
          padding: "0.75rem 1.5rem",
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? "auto" : "none",
          transition: "opacity 0.3s ease-in-out",
        }}
      >
        <button
          type="button"
          onClick={() =>
            handleActionWithVaultCheck(handleDownloadWithFriendlyErrors)
          }
          title={disableDownload ? "Download" : "Download (D)"}
          aria-label="Download"
          className="mv-toolbtn"
          style={{
            background: "transparent",
            border: "none",
            color: "white",
            cursor: "pointer",
            padding: "0.5rem",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          disabled={disableDownload}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>

        {!media.isShared && (
          <button
            type="button"
            onClick={() =>
              handleActionWithVaultCheck(() => {
                setShowAddToAlbum(true);
                loadAlbums();
              })
            }
            title="Add to Album (A)"
            aria-label="Add to Album"
            className="mv-toolbtn"
            style={{
              background: "transparent",
              border: "none",
              color: "white",
              cursor: "pointer",
              padding: "0.5rem",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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

        {!disableTrash && (
          <button
            type="button"
            onClick={() => handleActionWithVaultCheck(handleMoveToTrash)}
            title="Move to Trash (T)"
            aria-label="Move to Trash"
            className="mv-toolbtn"
            style={{
              background: "transparent",
              border: "none",
              color: "#ff6b6b",
              cursor: "pointer",
              padding: "0.5rem",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        )}

        {customActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              Promise.resolve(action.onClick()).catch((err: unknown) => {
                safeConsoleError("Custom action failed:", err);
                setError(getErrorMessage(err) || "Action failed");
              });
            }}
            title={action.label}
            aria-label={action.label}
            className="mv-toolbtn"
            style={{
              background: "transparent",
              border: "none",
              color: action.danger ? "#ff6b6b" : "white",
              cursor: "pointer",
              padding: "0.5rem",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {action.icon ?? (
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                {action.label}
              </span>
            )}
          </button>
        ))}
      </div>

      {isDownloading && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            bottom: "6rem",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            backdropFilter: "blur(4px)",
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <Loading size="small" />
          <span style={{ fontSize: "0.9rem" }}>
            {downloadProgress
              ? `Downloading… ${Math.round(
                  (downloadProgress.done /
                    Math.max(1, downloadProgress.total)) *
                    100,
                )}% (${formatBytes(downloadProgress.done)} / ${formatBytes(
                  downloadProgress.total,
                )})`
              : "Preparing download…"}
          </span>
        </div>
      )}

      <Modal
        open={showAddToAlbum}
        onClose={() => {
          setShowAddToAlbum(false);
          setSelectedAlbumId("");
        }}
        title="Add to Album"
        maxWidth="400px"
        footer={
          <>
            <button
              onClick={() => {
                setShowAddToAlbum(false);
                setSelectedAlbumId("");
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleAddToAlbum}
              disabled={isAddingToAlbum || !selectedAlbumId}
              className="btn btn-primary"
            >
              {isAddingToAlbum ? "Adding..." : "Add to Album"}
            </button>
          </>
        }
      >
        <div style={{ marginBottom: "1.5rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontWeight: "500",
            }}
          >
            Select Album
          </label>
          {isLoadingAlbums ? (
            <div>Loading albums...</div>
          ) : albums.length === 0 ? (
            <div
              style={{
                color: "var(--text-tertiary)",
                padding: "0.5rem",
                backgroundColor: "var(--bg-primary)",
                borderRadius: "4px",
              }}
            >
              No albums available. Create an album first.
            </div>
          ) : (
            <select
              value={selectedAlbumId}
              onChange={(e) => setSelectedAlbumId(e.target.value)}
              className="form-input"
              style={{ width: "100%" }}
            >
              <option value="">Select an album</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </Modal>

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
    </Modal>
  );
};
