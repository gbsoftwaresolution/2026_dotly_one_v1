import React, { useState, useEffect, useMemo } from "react";
import { mediaApi } from "../api/media";
import type { MediaResponse } from "../types/api";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";
import { MediaGrid } from "../components/MediaGrid";
import { MediaViewer } from "../components/MediaViewer";
import { useMediaCache } from "../hooks/useMediaCache";
import { invalidationEmitter } from "../hooks/useInvalidate";
import { removeWrappedKey } from "../crypto/keyStore";
import { useToast } from "../components/ToastProvider";

// --- Icons ---
const TrashIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const EmptyTrashIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18"></path>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const RestoreIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
    <path d="M3 3v5h5"></path>
  </svg>
);

const CheckIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export const Trash: React.FC = () => {
  const [trashedMedia, setTrashedMedia] = useState<MediaResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection Mode
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<MediaResponse | null>(null);

  const { loadMedia } = useMediaCache();
  const toast = useToast();

  useEffect(() => {
    fetchTrashedMedia();
    const unsubscribe = invalidationEmitter.on("trash", fetchTrashedMedia);
    return unsubscribe;
  }, []);

  const fetchTrashedMedia = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch specifically trashed items
      // Note: In real app, pagination should be handled. For now assuming < 100 items in trash or simple list
      const response = await mediaApi.list({ limit: 100 }, true);
      const items = Array.isArray(response?.items) ? response.items : [];
      // Filter client-side just in case API returns mixed content without strict filtering
      const trashed = items.filter((item) => item.isTrashed);
      setTrashedMedia(trashed);
    } catch (err: any) {
      setError(err.message || "Failed to load trashed media");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);

    // Auto-exit select mode if empty? Optional. Keeping it persistent for now.
    if (newSet.size === 0 && !isSelectMode) {
      // do nothing
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === trashedMedia.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(trashedMedia.map((m) => m.id)));
    }
  };

  const handleRestore = async (ids: string[]) => {
    if (ids.length === 0) return;
    const confirmMsg =
      ids.length === 1 ? "Restore this item?" : `Restore ${ids.length} items?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await Promise.all(ids.map((id) => mediaApi.restore(id)));
      setTrashedMedia((prev) => prev.filter((m) => !ids.includes(m.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      if (viewingMedia && ids.includes(viewingMedia.id)) {
        setViewerOpen(false);
      }
      invalidationEmitter.emit("library");
    } catch (err: any) {
      toast.danger(
        "Restore failed",
        err?.message
          ? `Failed to restore: ${err.message}`
          : "Failed to restore",
      );
    }
  };

  const handlePurge = async (ids: string[]) => {
    if (ids.length === 0) return;
    const confirmMsg =
      ids.length === 1
        ? "Delete permanently? This cannot be undone."
        : `Permanently delete ${ids.length} items? This cannot be undone.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await Promise.all(
        ids.map(async (id) => {
          await mediaApi.purge(id);
          await removeWrappedKey(id).catch(console.warn); // cleanup key, ignore error if missing
        }),
      );
      setTrashedMedia((prev) => prev.filter((m) => !ids.includes(m.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      if (viewingMedia && ids.includes(viewingMedia.id)) {
        setViewerOpen(false);
      }
    } catch (err: any) {
      toast.danger(
        "Delete failed",
        err?.message
          ? `Failed to delete permanently: ${err.message}`
          : "Failed to delete permanently",
      );
    }
  };

  const handleMediaClick = async (media: MediaResponse) => {
    if (isSelectMode) {
      toggleSelection(media.id);
    } else {
      try {
        await loadMedia(media);
        setViewingMedia(media);
        setViewerOpen(true);
      } catch (err: any) {
        toast.danger(
          "Open failed",
          err?.message
            ? `Cannot open media: ${err.message}`
            : "Cannot open media",
        );
      }
    }
  };

  // Retention Calculation
  const getDaysLeft = (trashedAt?: string | Date) => {
    if (!trashedAt) return 30;
    const date = new Date(trashedAt);
    const msPerDay = 1000 * 60 * 60 * 24;
    const expiryDate = new Date(date.getTime() + 30 * msPerDay);
    const diff = expiryDate.getTime() - Date.now();
    return Math.ceil(diff / msPerDay);
  };

  // Sort by days left (closest to deletion first)
  const sortedMedia = useMemo(() => {
    return [...trashedMedia].sort((a, b) => {
      const daysA = getDaysLeft(a.trashedAt);
      const daysB = getDaysLeft(b.trashedAt);
      return daysA - daysB;
    });
  }, [trashedMedia]);

  if (isLoading) return <Loading message="Loading trash..." />;
  if (error) return <ErrorState message={error} onRetry={fetchTrashedMedia} />;

  return (
    <div
      style={{
        paddingBottom: "4rem",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Sticky Premium Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backgroundColor: "rgba(10, 10, 10, 0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border-primary)",
          margin: "0 -2rem",
          padding: "1rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
            Trash
          </h1>
          {trashedMedia.length > 0 && (
            <p
              style={{
                margin: 0,
                fontSize: "0.8rem",
                color: "var(--text-tertiary)",
              }}
            >
              Items are deleted after 30 days
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {isSelectMode ? (
            <>
              <span
                style={{
                  fontSize: "0.9rem",
                  color: "var(--text-secondary)",
                  marginRight: "0.5rem",
                }}
              >
                {selectedIds.size} selected
              </span>
              <button
                onClick={handleSelectAll}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.85rem",
                  background: "transparent",
                  color: "var(--accent-primary)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {selectedIds.size === trashedMedia.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
              <button
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedIds(new Set());
                }}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.85rem",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "8px",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </>
          ) : (
            <>
              {trashedMedia.length > 0 && (
                <button
                  onClick={() => setIsSelectMode(true)}
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "0.85rem",
                    background: "transparent",
                    color: "var(--accent-primary)",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Select
                </button>
              )}
              {trashedMedia.length > 0 && (
                <button
                  onClick={() => handlePurge(trashedMedia.map((m) => m.id))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 1rem",
                    fontSize: "0.85rem",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: "8px",
                    color: "var(--danger)",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <EmptyTrashIcon />
                  Empty Trash
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingTop: "1.5rem", position: "relative" }}>
        {sortedMedia.length === 0 ? (
          <div
            style={{
              marginTop: "15vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              color: "var(--text-tertiary)",
              opacity: 0.6,
            }}
          >
            <TrashIcon />
            <h3 style={{ marginTop: "1rem", fontWeight: 500 }}>
              Trash is empty
            </h3>
          </div>
        ) : (
          <MediaGrid
            mediaItems={sortedMedia}
            onMediaClick={handleMediaClick}
            customActions={(media) => {
              const isSelected = selectedIds.has(media.id);
              const daysLeft = getDaysLeft(media.trashedAt);

              return (
                <>
                  {/* Days Left Badge */}
                  <div
                    style={{
                      position: "absolute",
                      top: "0.5rem",
                      left: "0.5rem",
                      background: "rgba(0,0,0,0.6)",
                      backdropFilter: "blur(4px)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "0.7rem",
                      color: daysLeft <= 3 ? "var(--danger)" : "#fff",
                      fontWeight: 600,
                      pointerEvents: "none",
                    }}
                  >
                    {daysLeft}d left
                  </div>

                  {/* Selection Checkbox Overlay */}
                  {isSelectMode && (
                    <div
                      style={{
                        position: "absolute",
                        top: "0.5rem",
                        right: "0.5rem",
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        border: isSelected
                          ? "none"
                          : "2px solid rgba(255,255,255,0.8)",
                        backgroundColor: isSelected
                          ? "var(--accent-primary)"
                          : "rgba(0,0,0,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#000",
                        transition: "all 0.2s",
                      }}
                    >
                      {isSelected && <CheckIcon />}
                    </div>
                  )}
                </>
              );
            }}
          />
        )}
      </div>

      {/* Bottom Action Bar (Select Mode) */}
      <div
        style={{
          position: "fixed",
          bottom: "2rem",
          left: "50%",
          transform: `translate(-50%, ${isSelectMode && selectedIds.size > 0 ? "0" : "150%"})`,
          backgroundColor: "rgba(25, 25, 25, 0.95)",
          backdropFilter: "blur(12px)",
          padding: "0.75rem 1.5rem",
          borderRadius: "16px",
          display: "flex",
          gap: "1.5rem",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          border: "1px solid var(--border-primary)",
          transition: "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
          zIndex: 100,
        }}
      >
        <button
          onClick={() => handleRestore(Array.from(selectedIds))}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.25rem",
            background: "none",
            border: "none",
            color: "var(--text-primary)",
            fontSize: "0.75rem",
            cursor: "pointer",
            minWidth: "60px",
          }}
        >
          <div style={{ fontSize: "1.25rem" }}>
            <RestoreIcon />
          </div>
          Restore
        </button>

        <button
          onClick={() => handlePurge(Array.from(selectedIds))}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.25rem",
            background: "none",
            border: "none",
            color: "var(--danger)",
            fontSize: "0.75rem",
            cursor: "pointer",
            minWidth: "60px",
          }}
        >
          <div style={{ fontSize: "1.25rem" }}>
            <EmptyTrashIcon />
          </div>
          Delete
        </button>
      </div>

      {viewingMedia && (
        <MediaViewer
          media={viewingMedia}
          open={viewerOpen}
          onClose={() => {
            setViewerOpen(false);
            setViewingMedia(null);
          }}
          disableTrash={true} // Already in trash
          customActions={[
            {
              label: "Restore",
              icon: <RestoreIcon />,
              onClick: async () => handleRestore([viewingMedia.id]),
            },
            {
              label: "Delete Permanently",
              icon: <EmptyTrashIcon />,
              onClick: async () => handlePurge([viewingMedia.id]),
              danger: true,
            },
          ]}
        />
      )}
    </div>
  );
};
