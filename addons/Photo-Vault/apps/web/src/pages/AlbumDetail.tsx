import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { albumsApi } from "../api/albums";
import { mediaApi } from "../api/media";
import type {
  AlbumResponse,
  AlbumItemResponse,
  MediaResponse,
} from "../types/api";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";
import { MediaGrid } from "../components/MediaGrid";
import { MediaPickerModal } from "../components/MediaPickerModal";
import { MediaViewer } from "../components/MediaViewer";
import { ShareAlbumModal } from "../components/ShareAlbumModal";
import { useInvalidator } from "../hooks/useInvalidate";
import { invalidationEmitter } from "../hooks/useInvalidate";
import { useToast } from "../components/ToastProvider";

// --- Icons ---
const ChevronLeftIcon = () => (
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
);

const PlusIcon = () => (
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
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const ShareIcon = () => (
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
    <circle cx="18" cy="5" r="3"></circle>
    <circle cx="6" cy="12" r="3"></circle>
    <circle cx="18" cy="19" r="3"></circle>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
  </svg>
);

const ImageIcon = () => (
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
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);

export const AlbumDetail: React.FC = () => {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();

  const [album, setAlbum] = useState<AlbumResponse | null>(null);
  const [items, setItems] = useState<AlbumItemResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaResponse | null>(
    null,
  );
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const invalidator = useInvalidator();
  const toast = useToast();

  useEffect(() => {
    if (albumId) {
      fetchAlbumDetails();
      const unsubscribe = invalidationEmitter.on("albums", fetchAlbumDetails);
      return unsubscribe;
    }
    return undefined;
  }, [albumId]);

  const fetchAlbumDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [albumData, itemsData] = await Promise.all([
        albumsApi.get(albumId!),
        albumsApi.listItems(albumId!, { limit: 100 }),
      ]);
      setAlbum(albumData);
      setItems(itemsData.items);
    } catch (err: any) {
      setError(err.message || "Failed to load album details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMedia = async (selectedMediaIds: string[]) => {
    if (!albumId || selectedMediaIds.length === 0) return;

    try {
      await albumsApi.addItems(albumId, selectedMediaIds);
      await fetchAlbumDetails();
      invalidator.invalidateAlbums();
      setMediaPickerOpen(false);
    } catch (err: any) {
      toast.danger(
        "Add failed",
        err?.message
          ? `Failed to add media: ${err.message}`
          : "Failed to add media",
      );
    }
  };

  const handleRemoveItem = async (mediaId: string) => {
    if (!albumId || !window.confirm("Remove from album?")) return;

    try {
      await albumsApi.removeItem(albumId, mediaId);
      setItems((prev) => prev.filter((item) => item.media.id !== mediaId));
      invalidator.invalidateAlbums();
    } catch (err: any) {
      toast.danger(
        "Remove failed",
        err?.message
          ? `Failed to remove from album: ${err.message}`
          : "Failed to remove from album",
      );
    }
  };

  const handleMediaClick = (media: MediaResponse) => {
    setSelectedMedia(media);
  };

  const handleMediaViewerClose = () => {
    setSelectedMedia(null);
  };

  const handleMediaTrash = async (mediaId: string) => {
    if (!window.confirm("Delete permanently?")) return;

    try {
      await mediaApi.trash(mediaId);
      setItems((prev) => prev.filter((i) => i.media.id !== mediaId));
      invalidator.invalidateLibrary(); // Broad invalidation
      handleMediaViewerClose();
    } catch (err: any) {
      toast.danger(
        "Trash failed",
        err?.message
          ? `Failed to trash media: ${err.message}`
          : "Failed to trash media",
      );
    }
  };

  if (isLoading) return <Loading message="Loading album..." />;
  if (error) return <ErrorState message={error} onRetry={fetchAlbumDetails} />;
  if (!album)
    return (
      <ErrorState
        message="Album not found"
        onRetry={() => navigate("/app/vault/albums")}
      />
    );

  // Transform items for MediaGrid
  const mediaItems = items.map((item) => item.media);

  return (
    <div
      style={{
        paddingBottom: "4rem",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Visual Header / Hero */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backgroundColor: "rgba(10, 10, 10, 0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border-primary)",
          margin: "0 -2rem",
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={() => navigate("/app/vault/albums")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: "4px",
              borderRadius: "50%",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--bg-elevated)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <ChevronLeftIcon />
          </button>

          <div>
            <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
              {album.name}
            </h1>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
                fontSize: "0.85rem",
                color: "var(--text-tertiary)",
              }}
            >
              <span>{items.length} items</span>
              {album.description && (
                <>
                  <span>•</span>
                  <span
                    style={{
                      maxWidth: "300px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {album.description}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={() => setShareModalOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-primary)",
              cursor: "pointer",
            }}
            title="Share Album"
          >
            <ShareIcon />
          </button>
          <button
            onClick={() => setMediaPickerOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 1rem",
              height: "36px",
              borderRadius: "99px",
              background: "var(--accent-primary)",
              color: "#000",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
              gap: "0.5rem",
            }}
          >
            <PlusIcon />
            Add Photos
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingTop: "2rem" }}>
        {items.length === 0 ? (
          <div
            style={{
              marginTop: "10vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              color: "var(--text-tertiary)",
            }}
          >
            <div style={{ opacity: 0.3, marginBottom: "1rem" }}>
              <ImageIcon />
            </div>
            <h3>Empty Album</h3>
            <p style={{ marginBottom: "1.5rem" }}>Add photos to get started.</p>
            <button
              onClick={() => setMediaPickerOpen(true)}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-primary)",
                borderRadius: "8px",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              Select Photos
            </button>
          </div>
        ) : (
          <MediaGrid
            mediaItems={mediaItems}
            onMediaClick={handleMediaClick}
            customActions={(media) => (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // This removes from album, not trash
                  handleRemoveItem(media.id);
                }}
                style={{
                  position: "absolute",
                  top: "0.5rem",
                  right: "0.5rem",
                  background: "rgba(0,0,0,0.6)",
                  border: "none",
                  borderRadius: "50%",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  cursor: "pointer",
                  opacity: 0.8,
                }}
                title="Remove from album"
              >
                <svg
                  width="14"
                  height="14"
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
            )}
          />
        )}
      </div>

      {/* Modals */}
      <MediaPickerModal
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onConfirm={handleAddMedia}
      />

      {selectedMedia && (
        <MediaViewer
          media={selectedMedia}
          open={true}
          onClose={handleMediaViewerClose}
          onTrash={handleMediaTrash}
        />
      )}

      {shareModalOpen && (
        <ShareAlbumModal
          albumId={album.id}
          open={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            fetchAlbumDetails();
          }}
        />
      )}
    </div>
  );
};
