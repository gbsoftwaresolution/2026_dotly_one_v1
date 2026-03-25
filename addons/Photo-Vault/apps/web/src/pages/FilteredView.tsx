import React, { useEffect, useMemo, useRef, useState } from "react";
import type { MediaResponse } from "../types/api";
import { mediaApi } from "../api/media";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";
import { MediaGrid } from "../components/MediaGrid";
import { MediaViewer } from "../components/MediaViewer";

type TopFilter = "ALL" | "PHOTOS" | "VIDEOS" | "DOCS" | "COMPRESSED";

type DocSubtype =
  | "ALL"
  | "PDF"
  | "DOCX"
  | "XLSX"
  | "PPTX"
  | "TXT"
  | "CSV"
  | "MD"
  | "HTML"
  | "JSON"
  | "XML"
  | "YAML"
  | "RTF"
  | "OTHER";

type ArchiveSubtype =
  | "ALL"
  | "ZIP"
  | "7Z"
  | "RAR"
  | "TAR"
  | "GZ"
  | "TGZ"
  | "TAR.GZ"
  | "TAR.TGZ"
  | "OTHER";

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

const normalizeContentType = (ct: string): string =>
  (String(ct || "").split(";")[0] ?? "").trim().toLowerCase();

const getLowerFilename = (name?: string | null) =>
  String(name || "").toLowerCase();

const getCompoundOrSimpleExt = (filename?: string | null): string => {
  const lower = getLowerFilename(filename);
  if (!lower) return "";

  if (lower.endsWith(".tar.gz")) return "tar.gz";
  if (lower.endsWith(".tar.tgz")) return "tar.tgz";

  const dot = lower.lastIndexOf(".");
  if (dot <= 0 || dot === lower.length - 1) return "";
  return lower.slice(dot + 1);
};

const isCompressedExt = (ext: string): boolean => {
  return (
    ext === "zip" ||
    ext === "7z" ||
    ext === "rar" ||
    ext === "tar" ||
    ext === "gz" ||
    ext === "tgz" ||
    ext === "tar.gz" ||
    ext === "tar.tgz"
  );
};

const inferDocSubtype = (media: MediaResponse): DocSubtype => {
  if (media.type !== "DOCUMENT") return "OTHER";

  const ct = normalizeContentType(media.contentType);
  const ext = getCompoundOrSimpleExt(media.originalFilename);

  // Keep archives out of document subtypes (they have their own tab).
  if (isCompressedExt(ext)) return "OTHER";

  if (ct === "application/pdf" || ext === "pdf") return "PDF";
  if (
    ct ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return "DOCX";
  }
  if (
    ct ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ext === "xlsx"
  ) {
    return "XLSX";
  }
  if (
    ct ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "pptx"
  ) {
    return "PPTX";
  }
  if (ct === "text/plain" || ext === "txt" || ext === "log") return "TXT";
  if (ct === "text/csv" || ext === "csv") return "CSV";
  if (ct === "text/markdown" || ext === "md" || ext === "markdown") return "MD";
  if (ct === "text/html" || ext === "html" || ext === "htm") return "HTML";
  if (ct === "application/json" || ext === "json") return "JSON";
  if (ct === "application/xml" || ct === "text/xml" || ext === "xml")
    return "XML";
  if (
    ct === "application/yaml" ||
    ct === "text/yaml" ||
    ext === "yml" ||
    ext === "yaml"
  ) {
    return "YAML";
  }
  if (ct === "application/rtf" || ct === "text/rtf" || ext === "rtf")
    return "RTF";

  return "OTHER";
};

const inferArchiveSubtype = (media: MediaResponse): ArchiveSubtype => {
  if (media.type !== "DOCUMENT") return "OTHER";
  const ct = normalizeContentType(media.contentType);
  const ext = getCompoundOrSimpleExt(media.originalFilename);

  if (ext === "tar.gz") return "TAR.GZ";
  if (ext === "tar.tgz") return "TAR.TGZ";

  if (ct === "application/zip" || ext === "zip") return "ZIP";
  if (ext === "7z") return "7Z";
  if (ext === "rar") return "RAR";
  if (ext === "tar") return "TAR";
  if (ext === "gz") return "GZ";
  if (ext === "tgz") return "TGZ";

  return "OTHER";
};

export const FilteredView: React.FC = () => {
  const [items, setItems] = useState<MediaResponse[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();

  const [topFilter, setTopFilter] = useState<TopFilter>("ALL");
  const [docSubtype, setDocSubtype] = useState<DocSubtype>("ALL");
  const [archiveSubtype, setArchiveSubtype] = useState<ArchiveSubtype>("ALL");

  const [selectedMedia, setSelectedMedia] = useState<MediaResponse | null>(
    null,
  );

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadMoreCooldownRef = useRef<TimeoutHandle | null>(null);

  const safeConsoleError = (...args: unknown[]) => {
    globalThis.console?.error(...args);
  };

  const fetchPage = async (cursor?: string) => {
    if (!cursor) {
      setIsInitialLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    setError(null);
    try {
      const res = await mediaApi.list({ limit: 60, cursor });
      const pageItems = Array.isArray(res?.items) ? res.items : [];

      setItems((prev) => {
        if (!cursor) return pageItems;
        const existing = new Set(prev.map((i) => i.id));
        const deduped = pageItems.filter((i) => !existing.has(i.id));
        return [...prev, ...deduped];
      });

      setNextCursor(res?.nextCursor);
    } catch (e: unknown) {
      safeConsoleError("Failed to load media:", e);
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Failed to load media");
    } finally {
      setIsInitialLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    void fetchPage();
  }, []);

  // Infinite scroll: loads next page when sentinel is visible.
  useEffect(() => {
    const el = loadMoreRef.current;
    const Observer = globalThis.IntersectionObserver;
    if (!el || !Observer) return;

    const obs = new Observer(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!nextCursor || isLoadingMore || isInitialLoading) return;

        // small cooldown to avoid rapid double-fires
        if (loadMoreCooldownRef.current) return;
        loadMoreCooldownRef.current = globalThis.setTimeout(() => {
          loadMoreCooldownRef.current = null;
        }, 500);

        void fetchPage(nextCursor);
      },
      { threshold: 0.1, rootMargin: "400px" },
    );

    obs.observe(el);
    return () => {
      obs.disconnect();
    };
  }, [nextCursor, isLoadingMore, isInitialLoading]);

  // Reset sub-filters when top filter changes.
  useEffect(() => {
    if (topFilter !== "DOCS") setDocSubtype("ALL");
    if (topFilter !== "COMPRESSED") setArchiveSubtype("ALL");
  }, [topFilter]);

  const filteredItems = useMemo(() => {
    const byTop = (m: MediaResponse): boolean => {
      if (topFilter === "ALL") return true;
      if (topFilter === "PHOTOS") return m.type === "PHOTO";
      if (topFilter === "VIDEOS") return m.type === "VIDEO";

      if (topFilter === "COMPRESSED") {
        if (m.type !== "DOCUMENT") return false;
        const ext = getCompoundOrSimpleExt(m.originalFilename);
        const ct = normalizeContentType(m.contentType);
        if (ct === "application/zip") return true;
        return isCompressedExt(ext);
      }

      // DOCS
      if (m.type !== "DOCUMENT") return false;
      const ext = getCompoundOrSimpleExt(m.originalFilename);
      if (isCompressedExt(ext)) return false;
      return true;
    };

    const bySubtype = (m: MediaResponse): boolean => {
      if (topFilter === "DOCS") {
        if (docSubtype === "ALL") return true;
        return inferDocSubtype(m) === docSubtype;
      }

      if (topFilter === "COMPRESSED") {
        if (archiveSubtype === "ALL") return true;
        return inferArchiveSubtype(m) === archiveSubtype;
      }

      return true;
    };

    return items.filter((m) => byTop(m) && bySubtype(m));
  }, [items, topFilter, docSubtype, archiveSubtype]);

  const selectedIndex = selectedMedia
    ? filteredItems.findIndex((m) => m.id === selectedMedia.id)
    : -1;
  const hasNext =
    selectedIndex !== -1 && selectedIndex < filteredItems.length - 1;
  const hasPrev = selectedIndex > 0;

  const handleNext = () => {
    if (!selectedMedia) return;
    if (!hasNext) return;
    const next = filteredItems[selectedIndex + 1];
    if (next) setSelectedMedia(next);
  };

  const handlePrev = () => {
    if (!selectedMedia) return;
    if (!hasPrev) return;
    const prev = filteredItems[selectedIndex - 1];
    if (prev) setSelectedMedia(prev);
  };

  const counts = useMemo(() => {
    const all = items.length;
    const photos = items.filter((m) => m.type === "PHOTO").length;
    const videos = items.filter((m) => m.type === "VIDEO").length;
    const compressed = items.filter((m) => {
      if (m.type !== "DOCUMENT") return false;
      const ext = getCompoundOrSimpleExt(m.originalFilename);
      const ct = normalizeContentType(m.contentType);
      if (ct === "application/zip") return true;
      return isCompressedExt(ext);
    }).length;
    const docs = items.filter((m) => {
      if (m.type !== "DOCUMENT") return false;
      const ext = getCompoundOrSimpleExt(m.originalFilename);
      return !isCompressedExt(ext);
    }).length;

    return { all, photos, videos, docs, compressed };
  }, [items]);

  const docSubtypeCounts = useMemo(() => {
    const map = new Map<DocSubtype, number>();

    const inc = (k: DocSubtype) => {
      map.set(k, (map.get(k) ?? 0) + 1);
    };

    for (const m of items) {
      if (m.type !== "DOCUMENT") continue;
      const ext = getCompoundOrSimpleExt(m.originalFilename);
      if (isCompressedExt(ext)) continue;

      inc("ALL");
      inc(inferDocSubtype(m));
    }

    return map;
  }, [items]);

  const archiveSubtypeCounts = useMemo(() => {
    const map = new Map<ArchiveSubtype, number>();

    const inc = (k: ArchiveSubtype) => {
      map.set(k, (map.get(k) ?? 0) + 1);
    };

    for (const m of items) {
      if (m.type !== "DOCUMENT") continue;
      const ext = getCompoundOrSimpleExt(m.originalFilename);
      const ct = normalizeContentType(m.contentType);
      const isArchive = ct === "application/zip" || isCompressedExt(ext);
      if (!isArchive) continue;

      inc("ALL");
      inc(inferArchiveSubtype(m));
    }

    return map;
  }, [items]);

  const docSubtypes: Array<{ value: DocSubtype; label: string }> = [
    { value: "ALL", label: "All docs" },
    { value: "PDF", label: "PDF" },
    { value: "DOCX", label: "DOCX" },
    { value: "XLSX", label: "XLSX" },
    { value: "PPTX", label: "PPTX" },
    { value: "TXT", label: "TXT" },
    { value: "CSV", label: "CSV" },
    { value: "MD", label: "Markdown" },
    { value: "HTML", label: "HTML" },
    { value: "JSON", label: "JSON" },
    { value: "XML", label: "XML" },
    { value: "YAML", label: "YAML" },
    { value: "RTF", label: "RTF" },
    { value: "OTHER", label: "Other" },
  ];

  const archiveSubtypes: Array<{ value: ArchiveSubtype; label: string }> = [
    { value: "ALL", label: "All archives" },
    { value: "ZIP", label: "ZIP" },
    { value: "7Z", label: "7Z" },
    { value: "RAR", label: "RAR" },
    { value: "TAR", label: "TAR" },
    { value: "GZ", label: "GZ" },
    { value: "TGZ", label: "TGZ" },
    { value: "TAR.GZ", label: "TAR.GZ" },
    { value: "TAR.TGZ", label: "TAR.TGZ" },
    { value: "OTHER", label: "Other" },
  ];

  if (isInitialLoading) {
    return <Loading message="Loading media…" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void fetchPage()} />;
  }

  const chipBaseStyle: React.CSSProperties = {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
  };

  return (
    <div style={{ paddingBottom: "4rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 650 }}>
          Filters
        </h1>
        <div style={{ color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
          Browse by type and file format.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <button
          className={
            topFilter === "ALL"
              ? "btn btn-primary btn-sm"
              : "btn btn-secondary btn-sm"
          }
          onClick={() => setTopFilter("ALL")}
        >
          All ({counts.all})
        </button>
        <button
          className={
            topFilter === "PHOTOS"
              ? "btn btn-primary btn-sm"
              : "btn btn-secondary btn-sm"
          }
          onClick={() => setTopFilter("PHOTOS")}
        >
          Photos ({counts.photos})
        </button>
        <button
          className={
            topFilter === "VIDEOS"
              ? "btn btn-primary btn-sm"
              : "btn btn-secondary btn-sm"
          }
          onClick={() => setTopFilter("VIDEOS")}
        >
          Videos ({counts.videos})
        </button>
        <button
          className={
            topFilter === "DOCS"
              ? "btn btn-primary btn-sm"
              : "btn btn-secondary btn-sm"
          }
          onClick={() => setTopFilter("DOCS")}
        >
          Docs ({counts.docs})
        </button>
        <button
          className={
            topFilter === "COMPRESSED"
              ? "btn btn-primary btn-sm"
              : "btn btn-secondary btn-sm"
          }
          onClick={() => setTopFilter("COMPRESSED")}
        >
          Compressed ({counts.compressed})
        </button>
      </div>

      {(topFilter === "DOCS" || topFilter === "COMPRESSED") && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ minWidth: 240, flex: "1 1 360px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                color: "var(--text-tertiary)",
                marginBottom: "0.35rem",
              }}
            >
              {topFilter === "DOCS" ? "Document type" : "Archive type"}
            </label>
            <div style={chipBaseStyle}>
              {(topFilter === "DOCS" ? docSubtypes : archiveSubtypes).map(
                (o) => {
                  const selected =
                    topFilter === "DOCS"
                      ? docSubtype === o.value
                      : archiveSubtype === o.value;

                  const count =
                    topFilter === "DOCS"
                      ? (docSubtypeCounts.get(o.value as DocSubtype) ?? 0)
                      : (archiveSubtypeCounts.get(o.value as ArchiveSubtype) ??
                        0);

                  return (
                    <button
                      key={o.value}
                      type="button"
                      className={
                        selected
                          ? "btn btn-primary btn-sm"
                          : "btn btn-secondary btn-sm"
                      }
                      aria-pressed={selected}
                      onClick={() => {
                        if (topFilter === "DOCS") {
                          setDocSubtype(o.value as DocSubtype);
                        } else {
                          setArchiveSubtype(o.value as ArchiveSubtype);
                        }
                      }}
                      title={o.label}
                    >
                      {o.label} ({count})
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <div style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>
            Showing{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {filteredItems.length}
            </strong>{" "}
            items
          </div>
        </div>
      )}

      {topFilter !== "DOCS" && topFilter !== "COMPRESSED" && (
        <div style={{ color: "var(--text-tertiary)", marginBottom: "1.25rem" }}>
          Showing{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {filteredItems.length}
          </strong>{" "}
          items
        </div>
      )}

      <MediaGrid
        mediaItems={filteredItems}
        onMediaClick={(m) => {
          setSelectedMedia(m);
        }}
        emptyMessage="No items match this filter yet."
      />

      <div
        ref={loadMoreRef}
        style={{ height: 1, width: "100%", marginTop: "2rem" }}
      />

      {isLoadingMore && (
        <div style={{ marginTop: "1.5rem" }}>
          <Loading message="Loading more…" />
        </div>
      )}

      {!isLoadingMore && nextCursor && (
        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              void fetchPage(nextCursor);
            }}
          >
            Load more
          </button>
        </div>
      )}

      {selectedMedia && (
        <MediaViewer
          open={true}
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onNext={handleNext}
          onPrev={handlePrev}
          hasNext={hasNext}
          hasPrev={hasPrev}
        />
      )}
    </div>
  );
};
