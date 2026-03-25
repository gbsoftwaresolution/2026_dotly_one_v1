import React, { useCallback, useEffect, useMemo, useState } from "react";
import { sharingApi } from "../api/sharing";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";

type ActiveShare = {
  id: string;
  album: {
    id: string;
    name: string;
    description?: string;
    coverMediaId?: string;
  };
  expiresAt: Date | string;
  createdAt: Date | string;
  viewCount?: number;
  lastViewedAt?: Date | string;
};

const formatDateTime = (value?: Date | string) => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
};

const formatDate = (value?: Date | string) => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
};

export const Shares: React.FC = () => {
  const [shares, setShares] = useState<ActiveShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyShareId, setBusyShareId] = useState<string | null>(null);

  const baseOrigin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const buildShareLink = (shareId: string) => `${baseOrigin}/shared/${shareId}`;

  const fetchShares = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await sharingApi.listActive();
      setShares(Array.isArray(items) ? (items as any) : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load shares");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const handleCopyLink = async (shareId: string) => {
    const link = buildShareLink(shareId);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Fallback for older browsers
      try {
        const el = document.createElement("textarea");
        el.value = link;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      } catch {
        // ignore
      }
    }
  };

  const handleOpenLink = (shareId: string) => {
    const link = buildShareLink(shareId);
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const handleRevoke = async (shareId: string) => {
    const ok = window.confirm(
      "Revoke this share link? People who have it will lose access.",
    );
    if (!ok) return;

    setBusyShareId(shareId);
    try {
      await sharingApi.revoke(shareId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch (err: any) {
      setError(err?.message || "Failed to revoke share");
    } finally {
      setBusyShareId(null);
    }
  };

  if (loading) {
    return <Loading message="Loading shares..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchShares} />;
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0, marginBottom: "0.25rem" }}>Shares</h1>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Manage your active share links and see views.
          </div>
        </div>

        <button
          className="btn btn-secondary"
          onClick={fetchShares}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {shares.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-primary)",
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
          }}
        >
          No active shares yet. Create one from an album.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "0.75rem",
          }}
        >
          {shares.map((share) => {
            const link = buildShareLink(share.id);
            const disabled = busyShareId === share.id;

            return (
              <div
                key={share.id}
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-elevated)",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "1rem",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: "0.25rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={share.album?.name}
                  >
                    {share.album?.name || "Untitled Album"}
                  </div>

                  {share.album?.description ? (
                    <div
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.9rem",
                        marginBottom: "0.5rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={share.album.description}
                    >
                      {share.album.description}
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                      color: "var(--text-tertiary)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span>Expires: {formatDate(share.expiresAt)}</span>
                    <span>Created: {formatDate(share.createdAt)}</span>
                    <span>Views: {share.viewCount ?? 0}</span>
                    <span>
                      Last viewed: {formatDateTime(share.lastViewedAt)}
                    </span>
                  </div>

                  <div style={{ marginTop: "0.75rem" }}>
                    <input
                      readOnly
                      value={link}
                      style={{
                        width: "100%",
                        maxWidth: "620px",
                        padding: "0.6rem 0.75rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-primary)",
                        color: "var(--text-tertiary)",
                        fontSize: "0.85rem",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    flexShrink: 0,
                  }}
                >
                  <button
                    className="btn btn-primary"
                    onClick={() => handleCopyLink(share.id)}
                    disabled={disabled}
                  >
                    Copy link
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleOpenLink(share.id)}
                    disabled={disabled}
                  >
                    Open
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleRevoke(share.id)}
                    disabled={disabled}
                  >
                    {disabled ? "Revoking…" : "Revoke"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
