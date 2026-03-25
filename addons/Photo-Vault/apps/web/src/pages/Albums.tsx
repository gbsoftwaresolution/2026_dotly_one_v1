import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { albumsApi } from "../api/albums";
import type {
  AlbumResponse,
  PaginatedAlbumResponse,
} from "@booster-vault/shared";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/ToastProvider";

// --- Icons ---
const PlusIcon = () => (
  <svg
    width="20"
    height="20"
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

const FolderIcon = () => (
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
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

const Trash2Icon = () => (
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
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

// --- Components ---

const AlbumCard: React.FC<{
  album: AlbumResponse;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}> = ({ album, onClick, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        cursor: "pointer",
        position: "relative",
      }}
    >
      {/* Cover Image / Placeholder */}
      <div
        style={{
          aspectRatio: "1",
          backgroundColor: "var(--bg-elevated)",
          borderRadius: "16px",
          overflow: "hidden",
          border: "1px solid var(--border-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "0.75rem",
          position: "relative",
          transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
          transform: isHovered ? "translateY(-4px)" : "none",
          boxShadow: isHovered ? "var(--shadow-lg)" : "var(--shadow-sm)",
        }}
      >
        {/* Placeholder for now - Real cover images would be loaded via media IDs */}
        <div style={{ color: "var(--text-disabled)", opacity: 0.5 }}>
          <FolderIcon />
        </div>

        {/* Overlay on Hover */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)",
            opacity: isHovered ? 1 : 0,
            transition: "opacity 0.2s",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            padding: "1rem",
          }}
        >
          <button
            onClick={onDelete}
            style={{
              background: "var(--bg-elevated)",
              border: "none",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--danger)",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
            title="Delete Album"
          >
            <Trash2Icon />
          </button>
        </div>
      </div>

      {/* Meta */}
      <div>
        <h3
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            margin: "0 0 0.25rem 0",
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {album.name}
        </h3>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--text-tertiary)",
            margin: 0,
          }}
        >
          {/* We could show item count here if available in API response */}
          {new Date(album.createdAt).getFullYear()}
        </p>
      </div>
    </div>
  );
};

const CreateAlbumModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string) => Promise<void>;
}> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(name, description);
      onClose();
    } catch (err) {
      // Error handled by parent usually, or we can add local state
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "1rem", // prevent edge touching on mobile
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "450px",
          backgroundColor: "var(--bg-elevated)",
          borderRadius: "16px",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-xl)",
          padding: "2rem",
          transform: "scale(1)",
          animation: "fadeIn 0.2s ease-out", // Assume global fadeIn keyframe exists or use inline
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: "0.5rem",
            fontSize: "1.5rem",
            fontWeight: 600,
          }}
        >
          New Album
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
          Create a collection for your memories
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.25rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Name
            </label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer Vacation 2024"
              style={{
                width: "100%",
                padding: "0.75rem",
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-primary)",
                borderRadius: "8px",
                color: "var(--text-primary)",
                fontSize: "1rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Description{" "}
              <span style={{ color: "var(--text-disabled)" }}>(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's in this album?"
              rows={3}
              style={{
                width: "100%",
                padding: "0.75rem",
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-primary)",
                borderRadius: "8px",
                color: "var(--text-primary)",
                fontSize: "1rem",
                resize: "none",
              }}
            />
          </div>

          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "var(--accent-primary)",
                border: "none",
                borderRadius: "8px",
                color: "#000", // Better contrast on cyan
                cursor:
                  !name.trim() || isSubmitting ? "not-allowed" : "pointer",
                fontSize: "0.9rem",
                fontWeight: 600,
                opacity: !name.trim() || isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Creating..." : "Create Album"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Main Page Component ---

export const Albums: React.FC = () => {
  const [albums, setAlbums] = useState<AlbumResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    fetchAlbums();
  }, []);

  const fetchAlbums = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response: PaginatedAlbumResponse = await albumsApi.list({
        limit: 50,
      });
      setAlbums(Array.isArray(response?.items) ? response.items : []);
    } catch (err: any) {
      setError(err.message || "Failed to load albums");
    } finally {
      setIsLoading(false);
    }
  };

  const createAlbum = async (name: string, description?: string) => {
    try {
      const album = await albumsApi.create({
        name: name.trim(),
        description: description?.trim() || undefined,
      });
      setAlbums((prev) => [album, ...prev]);
      navigate(`/app/albums/${album.id}`);
    } catch (err: any) {
      toast.danger(
        "Create failed",
        err?.message
          ? `Failed to create album: ${err.message}`
          : "Failed to create album",
      );
      throw err;
    }
  };

  const deleteAlbum = async (albumId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this album? Media inside will not be deleted.",
      )
    ) {
      return;
    }

    // Optimistic update could go here, but let's be safe
    try {
      await albumsApi.delete(albumId);
      setAlbums((prev) => prev.filter((a) => a.id !== albumId));
    } catch (err: any) {
      toast.danger(
        "Delete failed",
        err?.message
          ? `Failed to delete album: ${err.message}`
          : "Failed to delete album",
      );
    }
  };

  if (isLoading) {
    return <Loading message="Loading albums..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchAlbums} />;
  }

  return (
    <div
      style={{
        paddingBottom: "4rem",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: "1rem",
          marginBottom: "2.5rem",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "2rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              background: "linear-gradient(to right, #fff, #a1a1a1)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: "0.5rem",
            }}
          >
            Albums
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--text-tertiary)",
              fontSize: "1rem",
            }}
          >
            Your curated collections
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.25rem",
            backgroundColor: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-primary)",
            borderRadius: "99px", // Pill shape
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: 500,
            transition: "all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)",
            boxShadow: "var(--shadow-sm)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--bg-elevated)";
            e.currentTarget.style.transform = "none";
          }}
        >
          <PlusIcon />
          <span>New Album</span>
        </button>
      </div>

      {/* Grid */}
      {albums.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "2px dashed var(--border-primary)",
            borderRadius: "16px",
            padding: "4rem",
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-secondary)",
          }}
        >
          <div style={{ opacity: 0.5, marginBottom: "1.5rem" }}>
            <FolderIcon />
          </div>
          <h3 style={{ margin: "0 0 0.5rem 0" }}>No albums yet</h3>
          <p style={{ margin: "0 0 1.5rem 0", color: "var(--text-tertiary)" }}>
            Create an album to organize your photos and videos.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              padding: "0.75rem 2rem",
              backgroundColor: "var(--accent-primary)",
              color: "#000",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Create Album
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "2.5rem 2rem",
          }}
        >
          {/* Create New Card (optional visual cue in grid) */}
          <div
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget.firstChild as HTMLElement).style.borderColor =
                "var(--accent-primary)";
              (e.currentTarget.firstChild as HTMLElement).style.color =
                "var(--accent-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget.firstChild as HTMLElement).style.borderColor =
                "var(--border-primary)";
              (e.currentTarget.firstChild as HTMLElement).style.color =
                "var(--text-tertiary)";
            }}
          >
            <div
              style={{
                aspectRatio: "1",
                borderRadius: "16px",
                border: "2px dashed var(--border-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-tertiary)",
                transition: "all 0.2s",
              }}
            >
              <PlusIcon />
            </div>
            <span
              style={{
                fontSize: "0.9rem",
                fontWeight: 500,
                color: "var(--text-secondary)",
              }}
            >
              New Album
            </span>
          </div>

          {/* Album Cards */}
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              onClick={() => navigate(`/app/albums/${album.id}`)}
              onDelete={(e) => {
                e.stopPropagation();
                deleteAlbum(album.id);
              }}
            />
          ))}
        </div>
      )}

      <CreateAlbumModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createAlbum}
      />
    </div>
  );
};
