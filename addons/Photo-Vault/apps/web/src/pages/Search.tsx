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

// --- Icons ---
const SearchIcon = () => (
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
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const FilterIcon = () => (
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
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
  </svg>
);

const XIcon = () => (
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
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const HistoryIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
  </svg>
);

// --- CSS Transitions ---
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .search-result-enter {
    animation: fadeIn 0.4s ease-out forwards;
  }
  .shortcut-key {
    background: var(--bg-elevated);
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    padding: 0.1rem 0.4rem;
    font-size: 0.75rem;
    color: var(--text-tertiary);
    font-family: var(--font-mono);
  }
`;

// --- Types ---
interface DateGroup {
  id: string;
  date: Date;
  title: string;
  items: MediaResponse[];
}

export const Search: React.FC = () => {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const [mediaItems, setMediaItems] = useState<MediaResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Initial load
  const [isSearching, setIsSearching] = useState(false); // Subsequent searches
  const [error, setError] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaResponse | null>(
    null,
  );
  const [pagination, setPagination] = useState<{
    limit: number;
    nextCursor?: string;
  }>({ limit: 50, nextCursor: undefined });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Refs
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const { loadMedia } = useMediaCache();
  const toast = useToast();

  // Load Recent Searches
  useEffect(() => {
    const saved = localStorage.getItem("booster_recent_searches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved).slice(0, 5));
      } catch (e) {
        /* ignore */
      }
    }
  }, []);

  const saveRecentSearch = (query: string) => {
    if (!query.trim()) return;
    const newRecent = [
      query,
      ...recentSearches.filter((s) => s !== query),
    ].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem("booster_recent_searches", JSON.stringify(newRecent));
  };

  const removeRecentSearch = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    const newRecent = recentSearches.filter((s) => s !== query);
    setRecentSearches(newRecent);
    localStorage.setItem("booster_recent_searches", JSON.stringify(newRecent));
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K or / to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Esc to blur/clear
      if (e.key === "Escape") {
        if (selectedMedia) {
          // Let MediaViewer handle escape
        } else if (document.activeElement === inputRef.current) {
          inputRef.current?.blur();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMedia]);

  // Handle Search Input Change with Debounce
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim()) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value, dateFrom, dateTo);
        saveRecentSearch(value);
      }, 600);
    } else {
      setMediaItems([]);
      setPagination({ limit: 50, nextCursor: undefined });
      setIsSearching(false);
    }
  };

  const performSearch = async (
    q: string,
    from?: string,
    to?: string,
    cursor?: string,
  ) => {
    const isInitial = !cursor;

    try {
      if (isInitial) setError(null);

      const response: BrowsePaginatedMediaResponse = await browseApi.search({
        q: q.trim(),
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        limit: pagination.limit,
        cursor,
      });

      const items = Array.isArray(response?.items) ? response.items : [];

      setMediaItems((prev) => {
        if (isInitial) return items;
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = items.filter((i) => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });

      setPagination({
        limit: response.pagination.limit,
        nextCursor: response.pagination.nextCursor,
      });
    } catch (err: any) {
      if (isInitial) setError(err.message || "Failed to perform search");
    } finally {
      setIsLoading(false);
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (pagination.nextCursor && searchQuery.trim()) {
      setIsLoadingMore(true);
      performSearch(searchQuery, dateFrom, dateTo, pagination.nextCursor);
    }
  };

  // Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          pagination.nextCursor &&
          !isLoadingMore &&
          !isSearching
        ) {
          handleLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: "200px" },
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
      observer.disconnect();
    };
  }, [pagination.nextCursor, isLoadingMore, isSearching, searchQuery]);

  // Group items by Day
  const groupedSections = useMemo(() => {
    const groups: Record<string, DateGroup> = {};
    mediaItems.forEach((item) => {
      const dateStr =
        item.exifTakenAt || item.takenAt || new Date().toISOString();
      const date = new Date(dateStr);
      const key = date.toISOString().split("T")[0] || "unknown";

      if (!groups[key]) {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        let title = date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        if (date.toDateString() === today.toDateString()) title = "Today";
        else if (date.toDateString() === yesterday.toDateString())
          title = "Yesterday";

        groups[key] = { id: key, date, title, items: [] };
      }
      groups[key].items.push(item);
    });
    return Object.values(groups).sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );
  }, [mediaItems]);

  const handleMediaClick = async (media: MediaResponse) => {
    try {
      const objectUrl = await loadMedia(media);
      if (objectUrl) setSelectedMedia(media);
    } catch (err: any) {
      toast.danger(
        "Load failed",
        err?.message
          ? `Failed to load media: ${err.message}`
          : "Failed to load media",
      );
    }
  };

  const handleTrash = async (mediaId: string) => {
    if (window.confirm("Move this media to trash?")) {
      try {
        await mediaApi.trash(mediaId);
        setMediaItems((prev) => prev.filter((m) => m.id !== mediaId));
        if (selectedMedia?.id === mediaId) setSelectedMedia(null);
      } catch (err: any) {
        toast.danger(
          "Trash failed",
          err?.message
            ? `Failed to move: ${err.message}`
            : "Failed to move to trash",
        );
      }
    }
  };

  return (
    <div
      style={{
        paddingBottom: "4rem",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{styles}</style>

      {/* Sticky Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backgroundColor: "rgba(10, 10, 10, 0.85)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-primary)",
          margin: "0 -2rem",
          padding: "1.5rem 2rem",
          boxShadow: isInputFocused ? "0 4px 30px rgba(0,0,0,0.5)" : "none",
          transition: "box-shadow 0.3s",
        }}
      >
        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {/* Search Bar */}
          <div style={{ position: "relative", width: "100%", zIndex: 51 }}>
            <div
              style={{
                position: "absolute",
                left: "1.25rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: isInputFocused
                  ? "var(--accent-primary)"
                  : "var(--text-tertiary)",
                transition: "color 0.2s",
              }}
            >
              <SearchIcon />
            </div>

            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setTimeout(() => setIsInputFocused(false), 200)} // Delay to allow cliing recents
              placeholder="Search your memories..."
              style={{
                width: "100%",
                padding: "1.25rem 3.5rem",
                backgroundColor: isInputFocused
                  ? "var(--bg-elevated)"
                  : "var(--bg-secondary)",
                border: isInputFocused
                  ? "1px solid var(--accent-primary)"
                  : "1px solid transparent",
                borderRadius: "16px",
                fontSize: "1.1rem",
                color: "var(--text-primary)",
                outline: "none",
                boxShadow: isInputFocused
                  ? "0 0 0 4px var(--accent-primary-light)"
                  : "none",
                transition: "all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)",
              }}
            />

            {/* Clear Button or Shortcut Hint */}
            <div
              style={{
                position: "absolute",
                right: "1.25rem",
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              {searchQuery ? (
                <button
                  onClick={() => handleSearchInput("")}
                  style={{
                    background: "var(--bg-tertiary)",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    padding: "4px",
                    borderRadius: "50%",
                    display: "flex",
                  }}
                >
                  <XIcon />
                </button>
              ) : (
                <div style={{ display: "flex", gap: "4px", opacity: 0.5 }}>
                  <span className="shortcut-key">⌘K</span>
                </div>
              )}
            </div>

            {/* Recent Searches Dropdown */}
            {isInputFocused && !searchQuery && recentSearches.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: "0.5rem",
                  backgroundColor: "var(--bg-elevated)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "12px",
                  boxShadow: "var(--shadow-xl)",
                  overflow: "hidden",
                  animation: "fadeIn 0.2s ease-out",
                }}
              >
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    fontSize: "0.75rem",
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Recent Searches
                </div>
                {recentSearches.map((term, i) => (
                  <div
                    key={i}
                    onClick={() => handleSearchInput(term)}
                    style={{
                      padding: "0.75rem 1rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      borderTop: "1px solid var(--border-primary)",
                      color: "var(--text-secondary)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        "var(--bg-tertiary)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                      }}
                    >
                      <HistoryIcon />
                      <span>{term}</span>
                    </div>
                    <button
                      onClick={(e) => removeRecentSearch(e, term)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-disabled)",
                        cursor: "pointer",
                        padding: "4px",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--danger)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "var(--text-disabled)")
                      }
                    >
                      <XIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filters Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingLeft: "0.5rem",
            }}
          >
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "transparent",
                border: "none",
                color: showFilters
                  ? "var(--accent-primary)"
                  : "var(--text-secondary)",
                padding: "0.5rem 0",
                fontSize: "0.9rem",
                cursor: "pointer",
                fontWeight: 500,
                transition: "all 0.2s",
              }}
            >
              <FilterIcon />
              {showFilters ? "Hide Filters" : "Filters"}
            </button>

            {(dateFrom || dateTo) && (
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "var(--accent-primary)",
                  background: "var(--accent-primary-light)",
                  padding: "2px 8px",
                  borderRadius: "4px",
                }}
              >
                Active
              </span>
            )}
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                padding: "1.5rem",
                backgroundColor: "var(--bg-elevated)",
                borderRadius: "12px",
                border: "1px solid var(--border-primary)",
                animation: "fadeIn 0.2s ease-out",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <label
                  style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}
                >
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "0.9rem",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <label
                  style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}
                >
                  To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "0.9rem",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ marginTop: "1rem", flex: 1 }}>
        {/* Loading */}
        {(isLoading || isSearching) && (
          <div
            style={{
              padding: "4rem",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Loading message="Searching database..." />
          </div>
        )}

        {/* Error */}
        {error && !isLoading && !isSearching && (
          <ErrorState
            message={error}
            onRetry={() => performSearch(searchQuery, dateFrom, dateTo)}
          />
        )}

        {/* Start State */}
        {!searchQuery && !isLoading && !error && mediaItems.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              marginTop: "10vh",
              color: "var(--text-tertiary)",
            }}
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "24px",
                background:
                  "linear-gradient(135deg, var(--bg-elevated), var(--bg-tertiary))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1.5rem",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <SearchIcon />
            </div>
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "0.5rem",
              }}
            >
              Search your Vault
            </h2>
            <p style={{ textAlign: "center", maxWidth: "300px" }}>
              Find photos and videos by location, date, or any keyword.
            </p>
          </div>
        )}

        {/* No Matches */}
        {searchQuery &&
          !isSearching &&
          !isLoading &&
          mediaItems.length === 0 && (
            <div
              style={{
                textAlign: "center",
                marginTop: "4rem",
                color: "var(--text-secondary)",
              }}
            >
              <h3 style={{ marginBottom: "0.5rem" }}>No matches found</h3>
              <p style={{ color: "var(--text-tertiary)" }}>
                Try different keywords or check spelling.
              </p>
            </div>
          )}

        {/* Results with Animation */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
          {groupedSections.map((section, idx) => (
            <div
              key={section.id}
              className="search-result-enter"
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              <div
                style={{
                  marginBottom: "1rem",
                  display: "flex",
                  alignItems: "baseline",
                  gap: "1rem",
                  borderBottom: "1px solid var(--border-primary)",
                  paddingBottom: "0.5rem",
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
                  }}
                >
                  {section.date.toLocaleDateString()}
                </span>
              </div>

              <MediaGrid
                mediaItems={section.items}
                onMediaClick={handleMediaClick}
                onTrash={handleTrash}
              />
            </div>
          ))}
        </div>

        {/* Loader Sentinel */}
        <div
          ref={loadMoreRef}
          style={{
            height: "4rem",
            marginTop: "2rem",
            display: "flex",
            justifyContent: "center",
            opacity: isLoadingMore ? 1 : 0,
          }}
        >
          {isLoadingMore && (
            <div style={{ color: "var(--accent-primary)" }}>
              Loading more results...
            </div>
          )}
        </div>
      </div>

      {selectedMedia && (
        <MediaViewer
          media={selectedMedia}
          open={true}
          onClose={() => setSelectedMedia(null)}
          onTrash={handleTrash}
        />
      )}
    </div>
  );
};
