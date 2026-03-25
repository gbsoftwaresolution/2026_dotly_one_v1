import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { exportsApi } from "../api/exports";
import { albumsApi } from "../api/albums";
import type { ExportResponse } from "../types/api";
import type {
  ExportScopeType as SharedExportScopeType,
  ExportStatus as SharedExportStatus,
} from "@booster-vault/shared";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";
import { Banner } from "../components/Banner";

// -----------------------------------------------------------------------------
// Types & Constants
// -----------------------------------------------------------------------------

type ExportScopeType = SharedExportScopeType;

const ExportScopeType = {
  VAULT: "VAULT" as ExportScopeType,
  ALBUM: "ALBUM" as ExportScopeType,
  DATE_RANGE: "DATE_RANGE" as ExportScopeType,
} as const;

type ExportStatus = SharedExportStatus;

const ExportStatus = {
  QUEUED: "QUEUED" as ExportStatus,
  RUNNING: "RUNNING" as ExportStatus,
  READY: "READY" as ExportStatus,
  FAILED: "FAILED" as ExportStatus,
  EXPIRED: "EXPIRED" as ExportStatus,
} as const;

// -----------------------------------------------------------------------------
// Icons (Inline for portability/consistency)
// -----------------------------------------------------------------------------

const DownloadIcon = () => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

const TrashIcon = () => (
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
    <path d="M3 6h18"></path>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const PlusIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const ArchiveIcon = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ opacity: 0.5 }}
  >
    <polyline points="21 8 21 21 3 21 3 8"></polyline>
    <rect x="1" y="3" width="22" height="5"></rect>
    <line x1="10" y1="12" x2="14" y2="12"></line>
  </svg>
);

const CheckIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const AlertIcon = () => (
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
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const LockOpenIcon = () => (
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
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
  </svg>
);

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  let color = "var(--text-tertiary)";
  let bg = "var(--bg-elevated)";
  let borderColor = "transparent";
  let animate = false;

  switch (status) {
    case ExportStatus.READY:
      color = "#10b981"; // emerald-500
      bg = "rgba(16, 185, 129, 0.12)";
      borderColor = "rgba(16, 185, 129, 0.2)";
      break;
    case ExportStatus.RUNNING:
      color = "#3b82f6"; // blue-500
      bg = "rgba(59, 130, 246, 0.12)";
      borderColor = "rgba(59, 130, 246, 0.2)";
      animate = true;
      break;
    case ExportStatus.QUEUED:
      color = "#f59e0b"; // amber-500
      bg = "rgba(245, 158, 11, 0.12)";
      borderColor = "rgba(245, 158, 11, 0.2)";
      break;
    case ExportStatus.FAILED:
      color = "#ef4444"; // red-500
      bg = "rgba(239, 68, 68, 0.12)";
      borderColor = "rgba(239, 68, 68, 0.2)";
      break;
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: "99px",
        fontSize: "0.7rem",
        fontWeight: 700,
        color,
        backgroundColor: bg,
        border: `1px solid ${borderColor}`,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {animate && (
        <span
          style={{
            display: "block",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "currentColor",
            marginRight: "8px",
            animation: "pulse 2s infinite",
          }}
        />
      )}
      {status}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </span>
  );
};

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export const Exports: React.FC = () => {
  const navigate = useNavigate();

  const [exports, setExports] = useState<ExportResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [notice, setNotice] = useState<null | {
    type: "info" | "success" | "warning" | "danger";
    title: string;
    message: React.ReactNode;
  }>(null);

  // Auto-dismiss notices
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timeout);
  }, [notice]);

  // Polling logic for active jobs
  const hasActiveJob = exports.some(
    (e) =>
      e.status === ExportStatus.QUEUED || e.status === ExportStatus.RUNNING,
  );

  const fetchExports = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await exportsApi.list({ limit: 50 });
      setExports(res.items || []);
    } catch (err: any) {
      if (!isBackground) setError(err.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExports();
  }, [fetchExports]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (hasActiveJob) {
      interval = setInterval(() => {
        fetchExports(true);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [hasActiveJob, fetchExports]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this export?")) return;
    try {
      await exportsApi.delete(id);
      setExports((prev) => prev.filter((ex) => ex.id !== id));
    } catch (err: any) {
      setNotice({
        type: "danger",
        title: "Delete failed",
        message: err?.message ?? "Something went wrong while deleting.",
      });
    }
  };

  const buildExportFilename = (exp: ExportResponse): string => {
    const createdAt = new Date(exp.createdAt);
    const ts = createdAt
      .toISOString()
      .replace(/\..+Z$/, "Z")
      .replace("T", "_")
      .replace(/:/g, "-");

    const scopeLabel =
      exp.scopeType === "ALBUM"
        ? "album"
        : exp.scopeType === "DATE_RANGE"
          ? "date-range"
          : "vault";

    return `booster-vault-export-${scopeLabel}-${ts}.zip`;
  };

  const handleDownload = async (exp: ExportResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { url } = await exportsApi.getDownloadUrl(exp.id);
      if (url) {
        try {
          const link = document.createElement("a");
          link.href = url;
          link.target = "_self";
          link.rel = "noopener";
          link.download = buildExportFilename(exp);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch {
          window.location.assign(url);
        }

        setNotice({
          type: "success",
          title: "Download started",
          message: (
            <span>
              If your download didn’t start,{" "}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--accent-primary)",
                  textDecoration: "underline",
                }}
              >
                click here
              </a>
              .
            </span>
          ),
        });
      }
    } catch (err: any) {
      setNotice({
        type: "danger",
        title: "Download failed",
        message: err?.message ?? "Something went wrong while downloading.",
      });
    }
  };

  if (loading && !exports.length)
    return <Loading message="Loading exports..." />;

  if (error && !exports.length)
    return <ErrorState message={error} onRetry={() => fetchExports()} />;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-primary)",
      }}
    >
      {/* Toast Banner */}
      {notice && (
        <Banner
          type={notice.type}
          title={notice.title}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-primary)",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "1.25rem 2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "1.25rem",
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              Data Exports
            </h1>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "0.85rem",
                color: "var(--text-tertiary)",
              }}
            >
              Manage your encrypted data dumps
            </p>
          </div>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => navigate("/app/vault/exports/decrypt")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.6rem 1rem",
                backgroundColor: "transparent",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-primary)",
                borderRadius: "10px",
                fontWeight: 500,
                cursor: "pointer",
                fontSize: "0.85rem",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-elevated)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <LockOpenIcon />
              Decrypt Tool
            </button>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.6rem 1.25rem",
                backgroundColor: "var(--accent-primary)",
                color: "#000",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.85rem",
                boxShadow: "0 4px 12px rgba(74, 222, 128, 0.25)",
                transition: "transform 0.2s",
              }}
              onMouseDown={(e) =>
                (e.currentTarget.style.transform = "scale(0.97)")
              }
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <PlusIcon />
              New Export
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          padding: "2rem",
          maxWidth: "1200px",
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {exports.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "60vh",
              color: "var(--text-tertiary)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                padding: "2rem",
                borderRadius: "50%",
                backgroundColor: "var(--bg-elevated)",
                marginBottom: "1.5rem",
              }}
            >
              <ArchiveIcon />
            </div>
            <h2
              style={{
                margin: "0 0 0.5rem 0",
                fontSize: "1.5rem",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              No exports yet
            </h2>
            <p style={{ maxWidth: "400px", lineHeight: "1.5" }}>
              Generate a secure, encrypted backup of your entire vault or
              specific albums.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                marginTop: "2rem",
                padding: "0.8rem 2rem",
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-primary)",
                borderRadius: "12px",
                color: "var(--text-primary)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Create first export
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {exports.map((exp) => (
              <div
                key={exp.id}
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  borderRadius: "16px",
                  border: "1px solid var(--border-primary)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                  transition: "all 0.2s ease",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        marginBottom: "4px",
                      }}
                    >
                      {exp.scopeType === "ALBUM"
                        ? "Album Export"
                        : exp.scopeType === "DATE_RANGE"
                          ? "Date Range Export"
                          : "Full Vault Export"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-tertiary)",
                        fontFamily: "monospace",
                      }}
                    >
                      {new Date(exp.createdAt).toLocaleDateString()} •{" "}
                      {new Date(exp.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <StatusBadge status={exp.status} />
                </div>

                {/* Details Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1rem",
                    padding: "1rem",
                    backgroundColor: "var(--bg-primary)",
                    borderRadius: "8px",
                    border: "1px solid var(--border-primary)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-tertiary)",
                        textTransform: "uppercase",
                        marginBottom: "4px",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Scope
                    </div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {exp.scopeType === ExportScopeType.VAULT &&
                        "Complete Vault"}
                      {exp.scopeType === ExportScopeType.ALBUM &&
                        (exp.scopeAlbumId ? "Single Album" : "Unknown Album")}
                      {exp.scopeType === ExportScopeType.DATE_RANGE &&
                        "Custom Range"}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-tertiary)",
                        textTransform: "uppercase",
                        marginBottom: "4px",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Size
                    </div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                        fontWeight: 500,
                      }}
                    >
                      {exp.outputByteSize
                        ? (exp.outputByteSize / 1024 / 1024).toFixed(2) + " MB"
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* Error Banner if any */}
                {exp.status === ExportStatus.FAILED && exp.errorMessage && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "#ef4444",
                      backgroundColor: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "start",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ marginTop: "2px" }}>
                      <AlertIcon />
                    </div>
                    <div style={{ lineHeight: "1.4" }}>{exp.errorMessage}</div>
                  </div>
                )}

                {/* Actions Footer */}
                <div
                  style={{ marginTop: "auto", display: "flex", gap: "0.75rem" }}
                >
                  {exp.status === ExportStatus.READY && (
                    <button
                      onClick={(e) => handleDownload(exp, e)}
                      style={{
                        flex: 1,
                        padding: "0.5rem 1rem",
                        backgroundColor: "var(--text-primary)",
                        color: "var(--bg-primary)",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = "0.9")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.opacity = "1")
                      }
                    >
                      <DownloadIcon />
                      Download
                    </button>
                  )}

                  <button
                    onClick={(e) => handleDelete(exp.id, e)}
                    style={{
                      padding: "0.5rem 0.75rem",
                      backgroundColor: "transparent",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-tertiary)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s",
                      width:
                        exp.status === ExportStatus.READY ? "auto" : "100%",
                      justifySelf: "center",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--danger)";
                      e.currentTarget.style.color = "var(--danger)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        "var(--border-primary)";
                      e.currentTarget.style.color = "var(--text-tertiary)";
                    }}
                  >
                    <TrashIcon />
                    {(exp.status === ExportStatus.RUNNING ||
                      exp.status === ExportStatus.QUEUED) &&
                      " Cancel"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <CreateExportModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            setNotice({
              type: "success",
              title: "Export started",
              message: "We’re generating your export in the background.",
            });
            fetchExports();
          }}
        />
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Modal Implementation
// -----------------------------------------------------------------------------

interface CreateExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateExportModal: React.FC<CreateExportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [scopeType, setScopeType] = useState<ExportScopeType>(
    ExportScopeType.VAULT,
  );
  const [loading, setLoading] = useState(false);
  const [albums, setAlbums] = useState<{ id: string; name: string }[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  const [selectedAlbum, setSelectedAlbum] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (scopeType === ExportScopeType.ALBUM && !albums.length) {
      albumsApi.list({ limit: 100 }).then((res) => setAlbums(res.items));
    }
  }, [scopeType]);

  const handleCreate = async () => {
    setLoading(true);
    setCreateError(null);
    try {
      await exportsApi.create(scopeType, {
        albumId:
          scopeType === ExportScopeType.ALBUM ? selectedAlbum : undefined,
        from:
          scopeType === ExportScopeType.DATE_RANGE
            ? new Date(dateFrom)
            : undefined,
        to:
          scopeType === ExportScopeType.DATE_RANGE
            ? new Date(dateTo)
            : undefined,
      });
      onSuccess();
    } catch (err: any) {
      setCreateError(err?.message ?? "Failed to create export.");
    } finally {
      setLoading(false);
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
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#111", // darker dedicated bg for modal
          borderRadius: "24px",
          border: "1px solid var(--border-primary)",
          boxShadow:
            "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
          padding: "2rem",
          animation: "slideIn 0.2s ease-out",
        }}
      >
        <div style={{ marginBottom: "1.5rem" }}>
          <h2
            style={{
              margin: "0 0 0.5rem 0",
              fontSize: "1.25rem",
              color: "white",
            }}
          >
            Create Data Export
          </h2>
          <p
            style={{
              margin: 0,
              color: "var(--text-tertiary)",
              fontSize: "0.9rem",
            }}
          >
            Select the scope of data you wish to archive.
          </p>
        </div>

        {createError && (
          <div
            style={{
              marginBottom: "1.5rem",
              padding: "0.75rem 1rem",
              borderRadius: "12px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#ef4444",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <AlertIcon />
            {createError}
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          {[
            {
              id: ExportScopeType.VAULT,
              label: "Full Vault",
              desc: "Everything in your account",
            },
            {
              id: ExportScopeType.ALBUM,
              label: "Specific Album",
              desc: "Select a single album",
            },
            {
              id: ExportScopeType.DATE_RANGE,
              label: "Date Range",
              desc: "Filter by creation date",
            },
          ].map((opt) => {
            const isSelected = scopeType === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setScopeType(opt.id as ExportScopeType)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem",
                  borderRadius: "14px",
                  border: `1px solid ${isSelected ? "var(--accent-primary)" : "var(--border-primary)"}`,
                  backgroundColor: isSelected
                    ? "rgba(74, 222, 128, 0.05)"
                    : "transparent",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      color: isSelected
                        ? "var(--accent-primary)"
                        : "var(--text-primary)",
                    }}
                  >
                    {opt.label}
                  </div>
                  <div
                    style={{
                      color: "var(--text-tertiary)",
                      fontSize: "0.8rem",
                      marginTop: "2px",
                    }}
                  >
                    {opt.desc}
                  </div>
                </div>
                {isSelected && (
                  <div style={{ color: "var(--accent-primary)" }}>
                    <CheckIcon />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {scopeType === ExportScopeType.ALBUM && (
          <div style={{ marginBottom: "1.5rem", animation: "fadeIn 0.2s" }}>
            <select
              value={selectedAlbum}
              onChange={(e) => setSelectedAlbum(e.target.value)}
              style={{
                width: "100%",
                padding: "0.8rem",
                borderRadius: "12px",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-primary)",
                outline: "none",
                fontSize: "0.9rem",
              }}
            >
              <option value="">Select an album...</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {scopeType === ExportScopeType.DATE_RANGE && (
          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginBottom: "1.5rem",
              animation: "fadeIn 0.2s",
            }}
          >
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  marginBottom: "4px",
                }}
              >
                Start Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.6rem",
                  borderRadius: "8px",
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "white",
                  colorScheme: "dark",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  marginBottom: "4px",
                }}
              >
                End Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.6rem",
                  borderRadius: "8px",
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "white",
                  colorScheme: "dark",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "0.8rem",
              borderRadius: "12px",
              backgroundColor: "transparent",
              border: "1px solid var(--border-primary)",
              color: "var(--text-secondary)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={
              loading ||
              (scopeType === ExportScopeType.ALBUM && !selectedAlbum) ||
              (scopeType === ExportScopeType.DATE_RANGE &&
                (!dateFrom || !dateTo))
            }
            style={{
              flex: 1.5,
              padding: "0.8rem",
              borderRadius: "12px",
              backgroundColor: "var(--accent-primary)",
              border: "none",
              color: "#000",
              fontWeight: 600,
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.2s",
              boxShadow: "0 4px 12px rgba(74, 222, 128, 0.2)",
            }}
          >
            {loading ? "Initializing..." : "Start Export"}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
