import React, { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { mediaApi } from "../api/media";
import type { MediaResponse } from "../types/api";
import { Loading } from "./Loading";
import { ErrorState } from "./ErrorState";
import { MediaGrid } from "./MediaGrid";
import { useToast } from "./ToastProvider";

type PickerTab = {
  key: string;
  label: string;
  filter?: (media: MediaResponse) => boolean;
};

interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedMediaIds: string[]) => void;
  title?: string;
  message?: string;
  limit?: number;
  filter?: (media: MediaResponse) => boolean;
  emptyMessage?: string;
  tabs?: PickerTab[];
  defaultTabKey?: string;
}

export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({
  open,
  onClose,
  onConfirm,
  title = "Select Media",
  message = "Choose media items to add",
  limit = 50,
  filter,
  emptyMessage,
  tabs,
  defaultTabKey,
}) => {
  const [rawMediaItems, setRawMediaItems] = useState<MediaResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const toast = useToast();

  const resolvedDefaultTabKey = defaultTabKey || tabs?.[0]?.key;
  const [activeTabKey, setActiveTabKey] = useState<string | undefined>(
    resolvedDefaultTabKey,
  );

  const activeTab = (tabs || []).find((t) => t.key === activeTabKey);
  const combinedFilter = (m: MediaResponse) => {
    if (filter && !filter(m)) return false;
    if (activeTab?.filter && !activeTab.filter(m)) return false;
    return true;
  };

  const visibleMediaItems =
    (tabs && tabs.length > 0) || filter
      ? rawMediaItems.filter(combinedFilter)
      : rawMediaItems;

  useEffect(() => {
    if (open) {
      setRawMediaItems([]);
      setHasMore(true);
      setNextCursor(undefined);
      fetchMedia(undefined);
      setSelectedIds(new Set());
      setActiveTabKey(resolvedDefaultTabKey);
    }
  }, [open]);

  const fetchMedia = async (cursor?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await mediaApi.list({
        limit,
        cursor,
      });

      const rawItems = response.items || [];

      setRawMediaItems((prev) => (cursor ? [...prev, ...rawItems] : rawItems));
      setHasMore(Boolean(response.hasMore));
      setNextCursor(response.nextCursor || undefined);
    } catch (err: any) {
      setError(err.message || "Failed to load media");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelect = (mediaId: string, selected: boolean) => {
    const newSelected = new Set(selectedIds);
    if (selected) {
      newSelected.add(mediaId);
    } else {
      newSelected.delete(mediaId);
    }
    setSelectedIds(newSelected);
  };

  const handleConfirm = () => {
    if (selectedIds.size === 0) {
      toast.warning("Select media", "Please select at least one media item.");
      return;
    }
    onConfirm(Array.from(selectedIds));
  };

  const handleLoadMore = () => {
    if (!nextCursor) return;
    fetchMedia(nextCursor);
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="900px"
      footer={
        <>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
                marginRight: "auto",
              }}
            >
              Clear Selection
            </button>
          )}
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className="btn btn-primary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              minWidth: "120px",
              justifyContent: "center",
            }}
          >
            Add {selectedIds.size > 0 ? `${selectedIds.size} Items` : ""}
          </button>
        </>
      }
    >
      <p
        style={{
          margin: "0 0 var(--space-4)",
          color: "var(--text-secondary)",
          fontSize: "0.9rem",
        }}
      >
        {selectedIds.size > 0 ? `${selectedIds.size} selected` : message}
      </p>

      {tabs && tabs.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "var(--space-4)",
            flexWrap: "wrap",
          }}
        >
          {tabs.map((t) => {
            const isActive = t.key === activeTabKey;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTabKey(t.key)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "999px",
                  border: "1px solid var(--border)",
                  background: isActive ? "var(--bg-tertiary)" : "transparent",
                  color: "var(--text-primary)",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ position: "relative", minHeight: "300px" }}>
        {isLoading && rawMediaItems.length === 0 ? (
          <div
            style={{
              height: "300px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Loading message="Loading your library..." />
          </div>
        ) : error ? (
          <div
            style={{
              height: "300px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ErrorState message={error} onRetry={() => fetchMedia(undefined)} />
          </div>
        ) : (
          <>
            <MediaGrid
              mediaItems={visibleMediaItems}
              selectable={true}
              selectedIds={selectedIds}
              onSelect={handleToggleSelect}
              emptyMessage={emptyMessage || "No media found in your library."}
            />

            {hasMore && (
              <div style={{ textAlign: "center", padding: "2rem 0" }}>
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading || !nextCursor}
                  className="btn btn-secondary"
                >
                  {isLoading ? "Loading more..." : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
