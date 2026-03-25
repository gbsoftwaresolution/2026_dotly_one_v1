import React, { useState, useEffect, useRef, useMemo } from "react";
import { browseApi } from "../api/browse";
import type {
  BrowsePaginatedMediaResponse,
  MediaResponse,
} from "@booster-vault/shared";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";
import { MediaGrid } from "../components/MediaGrid";
import { MediaViewer } from "../components/MediaViewer";
import { useMediaCache } from "../hooks/useMediaCache";
import { mediaApi } from "../api/media";
import { useToast } from "../components/ToastProvider";

interface DateGroup {
  id: string;
  date: Date;
  title: string;
  items: MediaResponse[];
}

export const Timeline: React.FC = () => {
  const [mediaItems, setMediaItems] = useState<MediaResponse[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>();
  const [selectedMedia, setSelectedMedia] = useState<MediaResponse | null>(
    null,
  );
  const [pagination, setPagination] = useState<{
    limit: number;
    nextCursor?: string;
  }>({ limit: 50, nextCursor: undefined }); // Increased limit for better fill
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { loadMedia } = useMediaCache();
  const toast = useToast();

  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Generate last 15 years for dropdown
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => currentYear - i);

  useEffect(() => {
    fetchTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          pagination.nextCursor &&
          !isLoadingMore
        ) {
          handleLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: "200px" },
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) observer.unobserve(currentRef);
      observer.disconnect();
    };
  }, [pagination.nextCursor, isLoadingMore]);

  const fetchTimeline = async (cursor?: string) => {
    if (!cursor) {
      setInitialLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const response: BrowsePaginatedMediaResponse = await browseApi.timeline({
        year: selectedYear,
        limit: pagination.limit,
        cursor,
      });

      const items = Array.isArray(response?.items) ? response.items : [];

      setMediaItems((prev) => {
        if (!cursor) return items;
        // Deduplicate items just in case
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = items.filter((i) => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });

      setPagination({
        limit: response.pagination.limit,
        nextCursor: response.pagination.nextCursor,
      });
    } catch (err: any) {
      setError(err.message || "Failed to load timeline");
    } finally {
      setInitialLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedYear(value ? parseInt(value, 10) : undefined);
    setMediaItems([]); // Clear explicitly before fetch
  };

  const handleLoadMore = () => {
    if (pagination.nextCursor) {
      fetchTimeline(pagination.nextCursor);
    }
  };

  const handleMediaClick = async (media: MediaResponse) => {
    try {
      // Load the media into cache and get object URL
      const objectUrl = await loadMedia(media);
      if (objectUrl) {
        setSelectedMedia(media);
      }
    } catch (err: any) {
      toast.danger(
        "Load failed",
        err?.message
          ? `Failed to load media: ${err.message}`
          : "Failed to load media",
      );
    }
  };

  const handleCloseViewer = () => {
    setSelectedMedia(null);
  };

  const handleTrash = async (mediaId: string) => {
    if (window.confirm("Move this media to trash?")) {
      toast.info(
        "Not implemented",
        `Trash functionality will be implemented for media ${mediaId}.`,
      );
    }
  };

  // Group items by Day
  const groupedSections = useMemo(() => {
    const groups: Record<string, DateGroup> = {};

    mediaItems.forEach((item) => {
      // Prioritize exifTakenAt, then takenAt, then createdAt (if available), then now
      const dateStr =
        item.exifTakenAt || item.takenAt || new Date().toISOString();
      const date = new Date(dateStr);

      // key: YYYY-MM-DD
      const key = date.toISOString().split("T")[0] || "unknown";

      if (!groups[key]) {
        // Format relative date (Today, Yesterday, or Full Date)
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        let title = date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year:
            date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
        });

        if (date.toDateString() === today.toDateString()) {
          title = "Today";
        } else if (date.toDateString() === yesterday.toDateString()) {
          title = "Yesterday";
        }

        groups[key] = {
          id: key,
          date,
          title,
          items: [],
        };
      }
      groups[key].items.push(item);
    });

    // Sort groups descending by date
    return Object.values(groups).sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );
  }, [mediaItems]);

  if (initialLoading) {
    return <Loading message="Loading your memories..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => fetchTimeline()} />;
  }

  return (
    <div style={{ paddingBottom: "4rem" }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: "rgba(10, 10, 10, 0.8)", // Onyx black with opacity
          backdropFilter: "blur(12px)",
          padding: "1rem 0",
          borderBottom: "1px solid var(--border-primary)",
          margin: "0 -2rem 2rem -2rem", // Negative margin to stretch full width if container has padding
          paddingLeft: "2rem",
          paddingRight: "2rem",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "1.5rem",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            background: "linear-gradient(to right, #fff, #a1a1a1)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Timeline
        </h1>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <select
            id="year-filter"
            value={selectedYear || ""}
            onChange={handleYearChange}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid var(--border-secondary)",
              borderRadius: "8px",
              backgroundColor: "var(--onyx-medium)",
              color: "var(--text-primary)",
              fontSize: "0.875rem",
              cursor: "pointer",
              outline: "none",
              transition: "all 0.2s",
            }}
          >
            <option value="">All Time</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mediaItems.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 2rem",
            color: "var(--text-secondary)",
            background: "var(--onyx-darker)",
            borderRadius: "16px",
            marginTop: "2rem",
          }}
        >
          <h3>No photos yet</h3>
          <p style={{ marginTop: "0.5rem" }}>
            Photos and videos you upload will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
          {groupedSections.map((section) => (
            <div key={section.id}>
              <div
                style={{
                  marginBottom: "1rem",
                  display: "flex",
                  alignItems: "baseline",
                  gap: "0.75rem",
                }}
              >
                <h2
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    margin: 0,
                  }}
                >
                  {section.title}
                </h2>
                <span
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-tertiary)",
                    fontWeight: 400,
                  }}
                >
                  {section.date.getFullYear() !== new Date().getFullYear() &&
                    section.date.toLocaleDateString("en-US", {
                      year: "numeric",
                    })}
                </span>
              </div>

              <MediaGrid
                mediaItems={section.items}
                onMediaClick={handleMediaClick}
                onTrash={async (id) => {
                  try {
                    await mediaApi.trash(id);
                    setMediaItems((prev) => prev.filter((m) => m.id !== id));
                  } catch (err: any) {
                    toast.danger(
                      "Trash failed",
                      `Failed to move to trash: ${err?.message || String(err)}`,
                    );
                  }
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Infinite Scroll sentinel */}
      <div
        ref={loadMoreRef}
        style={{
          height: "2rem",
          marginTop: "2rem",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity: isLoadingMore ? 1 : 0,
          transition: "opacity 0.3s",
        }}
      >
        {isLoadingMore && (
          <div style={{ color: "var(--accent-primary)", fontSize: "0.875rem" }}>
            Loading more memories...
          </div>
        )}
      </div>

      {selectedMedia && (
        <MediaViewer
          media={selectedMedia}
          open={true}
          onClose={handleCloseViewer}
          onTrash={handleTrash}
        />
      )}
    </div>
  );
};
