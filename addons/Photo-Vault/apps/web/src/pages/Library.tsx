import React, { useState, useEffect } from "react";
import { mediaApi } from "../api/media";
import { albumsApi } from "../api/albums";
import type { MediaResponse, AlbumResponse } from "../types/api";
import { Loading } from "../components/Loading";
import { UploadDialog } from "../components/UploadDialog";
import { MediaViewer } from "../components/MediaViewer";
import { VaultUnlockModal } from "../components/VaultUnlockModal";
import { MediaGrid } from "../components/MediaGrid";
import { Banner } from "../components/Banner";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { isMasterKeyCached } from "../crypto/vaultKey";
import { useSubscription } from "../hooks/useSubscription";
import { useToast } from "../components/ToastProvider";

export const Library: React.FC = () => {
  const [media, setMedia] = useState<MediaResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [needUnlockModalOpen, setNeedUnlockModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaResponse | null>(
    null,
  );
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [albums, setAlbums] = useState<AlbumResponse[]>([]);
  const [showAddToAlbumDropdown, setShowAddToAlbumDropdown] = useState(false);
  const [uploadBlockedReason, setUploadBlockedReason] = useState<string | null>(
    null,
  );
  const { isPastDue, isExpired } = useSubscription();
  const toast = useToast();
  const [trashConfirmation, setTrashConfirmation] = useState<{
    open: boolean;
    itemIds: string[];
  }>({ open: false, itemIds: [] });
  const [isTrashing, setIsTrashing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<
    "ALL" | "PHOTO" | "VIDEO" | "DOCUMENT"
  >("ALL");

  const filteredMedia = Array.isArray(media)
    ? typeFilter === "ALL"
      ? media
      : media.filter((m) => m.type === typeFilter)
    : [];

  // When filtering in select mode, keep selection consistent with visible items.
  useEffect(() => {
    if (!selectMode) return;
    const visibleIds = new Set(filteredMedia.map((m) => m.id));
    setSelectedIds(
      (prev) => new Set(Array.from(prev).filter((id) => visibleIds.has(id))),
    );
  }, [typeFilter, selectMode, filteredMedia]);

  useEffect(() => {
    fetchMedia();
    fetchAlbums();
  }, []);

  const fetchMedia = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Pass cursor if we were doing pagination, but initial load is simple
      const response = await mediaApi.list({ limit: 20 });
      setMedia(Array.isArray(response?.items) ? response.items : []);
      setNextCursor(response?.nextCursor);
    } catch (err: any) {
      setError(err.message || "Failed to load media");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAlbums = async () => {
    try {
      const response = await albumsApi.list();
      setAlbums(Array.isArray(response?.items) ? response.items : []);
    } catch (err) {
      console.error("Failed to load albums:", err);
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    try {
      const response = await mediaApi.list({ limit: 20, cursor: nextCursor });
      if (response?.items) {
        setMedia((prev) => [...prev, ...response.items]);
        setNextCursor(response.nextCursor);
      }
    } catch (err) {
      console.error("Failed to load more media:", err);
    }
  };

  const handleUploadSuccess = () => {
    fetchMedia();
  };

  const handleMediaClick = (m: MediaResponse) => {
    if (selectMode) {
      handleSelectToggle(m.id, !selectedIds.has(m.id));
    } else {
      setSelectedMedia(m);
      setViewerOpen(true);
    }
  };

  const handleCloseViewer = () => {
    setViewerOpen(false);
    setSelectedMedia(null);
  };

  const handleSelectToggle = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedIds);
    if (selected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    const safeMedia = filteredMedia;
    if (safeMedia.length > 0 && selectedIds.size === safeMedia.length) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all
      setSelectedIds(new Set(safeMedia.map((m) => m.id)));
    }
  };

  const filterCounts = {
    all: Array.isArray(media) ? media.length : 0,
    photo: Array.isArray(media)
      ? media.filter((m) => m.type === "PHOTO").length
      : 0,
    video: Array.isArray(media)
      ? media.filter((m) => m.type === "VIDEO").length
      : 0,
    document: Array.isArray(media)
      ? media.filter((m) => m.type === "DOCUMENT").length
      : 0,
  };

  const filteredEmptyMessage =
    typeFilter === "PHOTO"
      ? "No photos found. Upload your first encrypted photo."
      : typeFilter === "VIDEO"
        ? "No videos found. Upload your first encrypted video."
        : typeFilter === "DOCUMENT"
          ? "No documents found. Upload your first encrypted document."
          : "No media found. Upload your first encrypted photo, video, or document.";

  const handleTrashSelected = () => {
    if (selectedIds.size === 0) return;
    setTrashConfirmation({
      open: true,
      itemIds: Array.from(selectedIds),
    });
  };

  const handleConfirmTrash = async () => {
    if (trashConfirmation.itemIds.length === 0) return;

    setIsTrashing(true);
    try {
      // Execute in parallel for better performance
      await Promise.all(
        trashConfirmation.itemIds.map((id) => mediaApi.trash(id)),
      );

      // Refresh media list
      await fetchMedia();

      // Clear selection and close modal
      setSelectedIds(new Set());
      setSelectMode(false);
      setTrashConfirmation({ open: false, itemIds: [] });
    } catch (err: any) {
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginTop: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <button
          className={
            typeFilter === "ALL"
              ? "btn btn-primary btn-sm"
              : "btn btn-secondary btn-sm"
          }
          onClick={() => setTypeFilter("ALL")}
          disabled={selectMode}
          title={
            selectMode ? "Exit selection mode to change filter" : undefined
          }
        >
          All ({filterCounts.all})
        </button>
        <button
          className={
            typeFilter === "PHOTO"
              ? "btn btn-primary btn-sm"
              : "btn btn-secondary btn-sm"
          }
          onClick={() => setTypeFilter("PHOTO")}
          disabled={selectMode}
          title={
            selectMode ? "Exit selection mode to change filter" : undefined
          }
        >
          Photos ({filterCounts.photo})
        </button>
        <button
          className={
            typeFilter === "VIDEO"
              ? "btn btn-primary btn-sm"
              : "btn btn-secondary btn-sm"
          }
          onClick={() => setTypeFilter("VIDEO")}
          disabled={selectMode}
          title={
            selectMode ? "Exit selection mode to change filter" : undefined
          }
        >
          Videos ({filterCounts.video})
        </button>
        <button
          className={
            typeFilter === "DOCUMENT"
              ? "btn btn-primary btn-sm"
              : "btn btn-secondary btn-sm"
          }
          onClick={() => setTypeFilter("DOCUMENT")}
          disabled={selectMode}
          title={
            selectMode ? "Exit selection mode to change filter" : undefined
          }
        >
          Documents ({filterCounts.document})
        </button>
      </div>;
      toast.danger(
        "Trash failed",
        err?.message
          ? `Failed to trash media: ${err.message}`
          : "Failed to trash media",
      );
      setTrashConfirmation({ open: false, itemIds: [] });
    } finally {
      setIsTrashing(false);
    }
  };

  const handleAddToAlbum = async (albumId: string) => {
    if (selectedIds.size === 0) return;

    try {
      await albumsApi.addItems(albumId, Array.from(selectedIds));
      toast.success(
        "Added to album",
        `Added ${selectedIds.size} item${selectedIds.size === 1 ? "" : "s"} to album`,
      );
      setShowAddToAlbumDropdown(false);
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (err: any) {
      if (err.status === 422) {
        toast.warning(
          "Some items skipped",
          "Some media items could not be added (they may have been deleted).",
        );
      } else {
        toast.danger(
          "Add failed",
          err?.message
            ? `Failed to add media to album: ${err.message}`
            : "Failed to add media to album",
        );
      }
    }
  };

  const handleUploadClick = () => {
    if (isPastDue || isExpired) {
      setUploadBlockedReason(
        "Subscription is past due. Please update billing to continue uploading.",
      );
      return;
    }
    // Check if trial limit reached? (Logic can be added here)
    setUploadBlockedReason(null);

    if (isMasterKeyCached()) {
      setUploadDialogOpen(true);
    } else {
      setNeedUnlockModalOpen(true);
    }
  };

  const handleNavNext = () => {
    if (!selectedMedia) return;
    const idx = filteredMedia.findIndex((m) => m.id === selectedMedia.id);
    if (idx !== -1 && idx < filteredMedia.length - 1) {
      const next = filteredMedia[idx + 1];
      if (next) setSelectedMedia(next);
    }
  };

  const handleNavPrev = () => {
    if (!selectedMedia) return;
    const idx = filteredMedia.findIndex((m) => m.id === selectedMedia.id);
    if (idx > 0) {
      const prev = filteredMedia[idx - 1];
      if (prev) setSelectedMedia(prev);
    }
  };

  const hasNext =
    !!selectedMedia &&
    filteredMedia.findIndex((m) => m.id === selectedMedia.id) <
      filteredMedia.length - 1;
  const hasPrev =
    !!selectedMedia &&
    filteredMedia.findIndex((m) => m.id === selectedMedia.id) > 0;

  if (isLoading) return <Loading />;

  // Note: We don't block the whole page on error -> we just show empty or partial state
  // but if it's a critical error (like verify email causing 403), we might want to handle it.

  return (
    <div className="container" style={{ maxWidth: "100%", padding: "0" }}>
      {error && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Banner
            type="danger"
            title="Couldn’t load media"
            message={error}
            onDismiss={() => setError(null)}
          />
        </div>
      )}
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-6)",
          marginTop: "var(--space-2)",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.875rem",
              marginBottom: "var(--space-2)",
              background:
                "linear-gradient(135deg, var(--text-primary), var(--text-secondary))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              display: "inline-block",
            }}
          >
            Library
          </h1>
          <p
            style={{
              color: "var(--text-tertiary)",
              fontSize: "0.9375rem",
              marginBottom: 0,
            }}
          >
            {media.length} items • Encrypted
          </p>
        </div>

        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          {selectMode ? (
            <>
              <button
                onClick={() => setSelectMode(false)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSelectAll}
                className="btn btn-secondary btn-sm"
              >
                {selectedIds.size === media.length
                  ? "Deselect All"
                  : "Select All"}
              </button>

              {selectedIds.size > 0 && (
                <>
                  <div style={{ position: "relative" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        setShowAddToAlbumDropdown(!showAddToAlbumDropdown)
                      }
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ marginRight: "4px" }}
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Add to Album
                    </button>
                    {showAddToAlbumDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          right: 0,
                          marginTop: "4px",
                          backgroundColor: "var(--bg-elevated)",
                          border: "1px solid var(--border-primary)",
                          borderRadius: "var(--radius-lg)",
                          padding: "4px",
                          minWidth: "200px",
                          zIndex: 20,
                          boxShadow: "var(--shadow-xl)",
                        }}
                      >
                        {albums.length === 0 ? (
                          <div
                            style={{
                              padding: "8px 12px",
                              fontSize: "13px",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            No albums found
                          </div>
                        ) : (
                          albums.map((album) => (
                            <button
                              key={album.id}
                              onClick={() => handleAddToAlbum(album.id)}
                              style={{
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                padding: "8px 12px",
                                background: "transparent",
                                border: "none",
                                color: "var(--text-primary)",
                                cursor: "pointer",
                                fontSize: "14px",
                                borderRadius: "4px",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                  "var(--bg-tertiary)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background =
                                  "transparent")
                              }
                            >
                              {album.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleTrashSelected}
                    className="btn btn-danger btn-sm"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginRight: "4px" }}
                    >
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Trash ({selectedIds.size})
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {media.length > 0 && (
                <button
                  onClick={() => setSelectMode(true)}
                  className="btn btn-secondary btn-sm"
                >
                  Select
                </button>
              )}

              <button
                onClick={handleUploadClick}
                className="btn btn-primary btn-sm"
                style={{
                  backgroundColor: "var(--accent-primary)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Upload Media
              </button>
            </>
          )}
        </div>
      </div>

      {/* Subscription Alert */}
      {uploadBlockedReason && (
        <Banner
          type="warning"
          title="Subscription Alert"
          message={uploadBlockedReason}
          action={{
            label: "Update Billing",
            onClick: () => (window.location.href = "/app/vault/billing"),
          }}
        />
      )}

      {/* Main Grid Area */}
      <div style={{ minHeight: "60vh" }}>
        <MediaGrid
          mediaItems={filteredMedia}
          onMediaClick={handleMediaClick}
          onTrash={(id) => {
            setTrashConfirmation({ open: true, itemIds: [id] });
          }}
          selectable={selectMode}
          selectedIds={selectedIds}
          onSelect={handleSelectToggle}
          emptyMessage={filteredEmptyMessage}
        />

        {nextCursor && !selectMode && (
          <div
            style={{
              textAlign: "center",
              marginTop: "var(--space-8)",
              paddingBottom: "var(--space-8)",
            }}
          >
            <button onClick={handleLoadMore} className="btn btn-secondary">
              Load More Items
            </button>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <UploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onSuccess={handleUploadSuccess}
        onNeedUnlock={() => setNeedUnlockModalOpen(true)}
      />

      <VaultUnlockModal
        open={needUnlockModalOpen}
        onClose={() => setNeedUnlockModalOpen(false)}
        onUnlockSuccess={() => {
          setNeedUnlockModalOpen(false);
          setUploadDialogOpen(true);
        }}
        title="Unlock Vault"
        message="Enter your vault password to manage media."
      />

      {selectedMedia && (
        <MediaViewer
          media={selectedMedia}
          open={viewerOpen}
          onClose={handleCloseViewer}
          skipConfirm
          onTrash={async (id) => {
            setTrashConfirmation({ open: true, itemIds: [id] });
            setViewerOpen(false);
          }}
          onNext={handleNavNext}
          onPrev={handleNavPrev}
          hasNext={hasNext}
          hasPrev={hasPrev}
        />
      )}

      <ConfirmationModal
        open={trashConfirmation.open}
        title="Move to Trash"
        message={`Are you sure you want to move ${trashConfirmation.itemIds.length} item${trashConfirmation.itemIds.length === 1 ? "" : "s"} to trash?`}
        confirmLabel="Move to Trash"
        isDestructive
        isLoading={isTrashing}
        onConfirm={handleConfirmTrash}
        onClose={() => setTrashConfirmation({ open: false, itemIds: [] })}
      />
    </div>
  );
};
