import React, { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApproveCardContactRequestDto,
  ApproveCardContactRequestResponse,
  CardAttachmentResponse,
  CardModeAnalyticsResponse,
  CardModePublicResponse,
  CreateCardModeDto,
} from "@booster-vault/shared";
import { ApiError } from "../api/client";
import { cardOwnerApi } from "../api/card.owner";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";

function asMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const anyData = err.data as any;
    return anyData?.message || err.message || `Request failed (${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

function errorCode(err: unknown): string | undefined {
  if (!(err instanceof ApiError)) return undefined;
  const anyData = err.data as any;
  return typeof anyData?.code === "string" ? anyData.code : undefined;
}

function formatDateTime(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function maskToken(token: string): string {
  const t = token.trim();
  if (t.length <= 10) return "••••••";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

export const CardDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modes, setModes] = useState<CardModePublicResponse[]>([]);
  const [selectedModeId, setSelectedModeId] = useState<string>("");

  const [createMode, setCreateMode] = useState<CreateCardModeDto>({
    name: "",
    slug: "",
    headline: "",
    bio: "",
    contactGate: "REQUEST_REQUIRED",
    indexingEnabled: true,
    themeKey: "",
  });
  const [createModeBusy, setCreateModeBusy] = useState(false);
  const [createModeError, setCreateModeError] = useState<string | null>(null);

  const [requestsBusy, setRequestsBusy] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<
    Array<{
      id: string;
      status: string;
      requesterName: string;
      requesterEmail: string;
      requesterPhone?: string;
      message?: string;
      createdAt: string;
    }>
  >([]);

  const [approveBusyId, setApproveBusyId] = useState<string | null>(null);
  const [denyBusyId, setDenyBusyId] = useState<string | null>(null);

  const [approveChoiceByRequestId, setApproveChoiceByRequestId] = useState<
    Record<string, { kind: "7" | "30" | "custom"; customExpiresAt?: string }>
  >({});

  const [lastGrant, setLastGrant] = useState<
    (ApproveCardContactRequestResponse & { requestId: string }) | null
  >(null);
  const [showGrantToken, setShowGrantToken] = useState(false);
  const [revokeGrantBusy, setRevokeGrantBusy] = useState(false);

  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<CardAttachmentResponse[]>([]);

  const [addAlbum, setAddAlbum] = useState<{ albumId: string; label: string }>({
    albumId: "",
    label: "",
  });
  const [addAlbumBusy, setAddAlbumBusy] = useState(false);

  const [analyticsBusy, setAnalyticsBusy] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<CardModeAnalyticsResponse | null>(
    null,
  );

  const [username, setUsername] = useState("");
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [usernameResult, setUsernameResult] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const baseOrigin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const selectedMode = useMemo(
    () => modes.find((m) => m.modeId === selectedModeId) ?? null,
    [modes, selectedModeId],
  );

  const refreshModes = useCallback(async () => {
    setError(null);
    try {
      const res = await cardOwnerApi.listModes();
      const items = Array.isArray(res.items) ? res.items : [];
      setModes(items);
      if (!selectedModeId && items[0]?.modeId) {
        setSelectedModeId(items[0].modeId);
      } else if (
        selectedModeId &&
        !items.some((m) => m.modeId === selectedModeId)
      ) {
        setSelectedModeId(items[0]?.modeId ?? "");
      }
    } catch (e) {
      setError(asMessage(e));
    }
  }, [selectedModeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await cardOwnerApi.listModes();
        if (cancelled) return;

        const items = Array.isArray(res.items) ? res.items : [];
        setModes(items);
        setSelectedModeId((prev) => prev || items[0]?.modeId || "");
      } catch (e) {
        if (cancelled) return;
        setError(asMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedModeId) return;

    let cancelled = false;
    (async () => {
      setRequestsBusy(true);
      setRequestsError(null);
      try {
        const res = await cardOwnerApi.listContactRequests(
          selectedModeId,
          "PENDING",
          50,
        );
        if (cancelled) return;
        setPendingRequests(res.items ?? []);
      } catch (e) {
        if (cancelled) return;
        setRequestsError(asMessage(e));
      } finally {
        if (!cancelled) setRequestsBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedModeId]);

  useEffect(() => {
    if (!selectedModeId) return;

    let cancelled = false;
    (async () => {
      setAttachmentsBusy(true);
      setAttachmentsError(null);
      try {
        const list = await cardOwnerApi.listAttachments(selectedModeId);
        if (cancelled) return;
        setAttachments(list ?? []);
      } catch (e) {
        if (cancelled) return;
        setAttachmentsError(asMessage(e));
      } finally {
        if (!cancelled) setAttachmentsBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedModeId]);

  useEffect(() => {
    if (!selectedModeId) return;

    let cancelled = false;
    (async () => {
      setAnalyticsBusy(true);
      setAnalyticsError(null);
      try {
        const a = await cardOwnerApi.getModeAnalytics(selectedModeId);
        if (cancelled) return;
        setAnalytics(a);
      } catch (e) {
        if (cancelled) return;
        setAnalyticsError(asMessage(e));
      } finally {
        if (!cancelled) setAnalyticsBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedModeId]);

  const buildPublicLink = (mode: CardModePublicResponse) => {
    return `${baseOrigin}/u/${mode.cardPublicId}/${mode.slug}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      } catch {
        // ignore
      }
    }
  };

  const handleCreateMode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateModeError(null);
    setCreateModeBusy(true);

    try {
      const dto: CreateCardModeDto = {
        name: createMode.name,
        slug: createMode.slug,
        headline: createMode.headline?.trim() || undefined,
        bio: createMode.bio?.trim() || undefined,
        contactGate: createMode.contactGate,
        indexingEnabled: createMode.indexingEnabled,
        themeKey: createMode.themeKey?.trim() || undefined,
      };

      const newMode = await cardOwnerApi.createMode(dto);
      setModes((prev) => [newMode, ...prev]);
      setSelectedModeId(newMode.modeId);
      setCreateMode({
        name: "",
        slug: "",
        headline: "",
        bio: "",
        contactGate: "REQUEST_REQUIRED",
        indexingEnabled: true,
        themeKey: "",
      });
    } catch (e2) {
      const code = errorCode(e2);
      if (code === "CARD_MODE_LIMIT_REACHED") {
        setCreateModeError(
          "Mode limit reached. Upgrade to Premium for more modes.",
        );
      } else {
        setCreateModeError(asMessage(e2));
      }
    } finally {
      setCreateModeBusy(false);
    }
  };

  const approveRequest = async (requestId: string) => {
    if (!selectedModeId) return;

    const choice = approveChoiceByRequestId[requestId]?.kind ?? "7";
    const custom = approveChoiceByRequestId[requestId]?.customExpiresAt;

    const dto: ApproveCardContactRequestDto =
      choice === "custom"
        ? {
            expiresAt: custom ? new Date(custom).toISOString() : undefined,
          }
        : {
            expiresInDays: choice === "30" ? 30 : 7,
          };

    if (choice === "custom" && !dto.expiresAt) {
      setRequestsError("Choose a custom expiry date/time");
      return;
    }

    setRequestsError(null);
    setApproveBusyId(requestId);
    try {
      const grant = await cardOwnerApi.approveRequest(requestId, dto);
      setLastGrant({ ...grant, requestId });
      setShowGrantToken(false);
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (e) {
      setRequestsError(asMessage(e));
    } finally {
      setApproveBusyId(null);
    }
  };

  const denyRequest = async (requestId: string) => {
    const ok = window.confirm("Deny this contact request?");
    if (!ok) return;

    setRequestsError(null);
    setDenyBusyId(requestId);
    try {
      await cardOwnerApi.denyRequest(requestId);
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (e) {
      setRequestsError(asMessage(e));
    } finally {
      setDenyBusyId(null);
    }
  };

  const revokeLastGrant = async () => {
    if (!lastGrant) return;
    const ok = window.confirm(
      "Revoke this grant? The token will stop working.",
    );
    if (!ok) return;

    setRevokeGrantBusy(true);
    try {
      await cardOwnerApi.revokeGrant(lastGrant.grantId);
      setLastGrant(null);
      setShowGrantToken(false);
    } catch (e) {
      setRequestsError(asMessage(e));
    } finally {
      setRevokeGrantBusy(false);
    }
  };

  const moveAttachment = async (attachmentId: string, dir: -1 | 1) => {
    if (!selectedModeId) return;
    const idx = attachments.findIndex((a) => a.id === attachmentId);
    if (idx < 0) return;

    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= attachments.length) return;

    const next = [...attachments];
    const item = next[idx];
    if (!item) return;
    next.splice(idx, 1);
    next.splice(nextIdx, 0, item);

    setAttachments(next);
    try {
      const updated = await cardOwnerApi.reorderAttachments(
        selectedModeId,
        next.map((x) => x.id),
      );
      setAttachments(updated);
    } catch (e) {
      setAttachmentsError(asMessage(e));
      // fallback refresh
      try {
        const list = await cardOwnerApi.listAttachments(selectedModeId);
        setAttachments(list);
      } catch {
        // ignore
      }
    }
  };

  const addAlbumAttachment = async () => {
    if (!selectedModeId) return;
    const albumId = addAlbum.albumId.trim();
    if (!albumId) return;

    setAddAlbumBusy(true);
    setAttachmentsError(null);
    try {
      const created = await cardOwnerApi.createAttachment(selectedModeId, {
        kind: "ALBUM",
        refId: albumId,
        label: addAlbum.label.trim() || undefined,
        sortOrder: attachments.length,
      });
      setAttachments((prev) => [...prev, created]);
      setAddAlbum({ albumId: "", label: "" });
    } catch (e) {
      setAttachmentsError(asMessage(e));
    } finally {
      setAddAlbumBusy(false);
    }
  };

  const revokeAttachment = async (attachmentId: string) => {
    const ok = window.confirm(
      "Revoke this attachment? It will stop resolving for visitors.",
    );
    if (!ok) return;

    setAttachmentsError(null);
    try {
      await cardOwnerApi.revokeAttachment(attachmentId);
      await refreshModes();
      if (selectedModeId) {
        const list = await cardOwnerApi.listAttachments(selectedModeId);
        setAttachments(list);
      }
    } catch (e) {
      setAttachmentsError(asMessage(e));
    }
  };

  const deleteAttachment = async (attachmentId: string) => {
    const ok = window.confirm("Delete this attachment? This cannot be undone.");
    if (!ok) return;

    setAttachmentsError(null);
    try {
      await cardOwnerApi.deleteAttachment(attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (e) {
      setAttachmentsError(asMessage(e));
    }
  };

  const saveAttachmentLabel = async (attachmentId: string, label: string) => {
    setAttachmentsError(null);
    try {
      const updated = await cardOwnerApi.updateAttachment(attachmentId, {
        label: label.trim() || undefined,
      });
      setAttachments((prev) =>
        prev.map((a) => (a.id === attachmentId ? updated : a)),
      );
    } catch (e) {
      setAttachmentsError(asMessage(e));
    }
  };

  const handleUpdateUsername = async () => {
    const u = username.trim().toLowerCase();
    if (!u) return;

    setUsernameBusy(true);
    setUsernameError(null);
    setUsernameResult(null);
    try {
      const res = await cardOwnerApi.updateUsername({ username: u });
      setUsernameResult(res.username);
    } catch (e) {
      setUsernameError(asMessage(e));
    } finally {
      setUsernameBusy(false);
    }
  };

  if (loading) return <Loading message="Loading card dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={refreshModes} />;

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
          <h1 style={{ margin: 0, marginBottom: "0.25rem" }}>Card</h1>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Manage your Personal Card modes, requests, attachments, and
            analytics.
          </div>
        </div>

        <button className="btn btn-secondary" onClick={refreshModes}>
          Refresh
        </button>
      </div>

      {/* A — Links */}
      <div
        style={{
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-primary)",
          background: "var(--bg-elevated)",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Your public links</h2>
        {modes.length === 0 ? (
          <div style={{ color: "var(--text-secondary)" }}>
            No modes yet. Create your first mode below.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {modes.map((m) => {
              const link = buildPublicLink(m);
              return (
                <div
                  key={m.modeId}
                  style={{
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-primary)",
                    borderRadius: "var(--radius-md)",
                    padding: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <div
                      style={{
                        color: "var(--text-tertiary)",
                        fontSize: "0.85rem",
                      }}
                    >
                      /{m.slug}
                    </div>
                    <input
                      readOnly
                      value={link}
                      style={{
                        width: "min(680px, 100%)",
                        marginTop: "0.5rem",
                        padding: "0.6rem 0.75rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-primary)",
                        color: "var(--text-tertiary)",
                        fontSize: "0.85rem",
                      }}
                    />
                  </div>

                  <div
                    style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}
                  >
                    <button
                      className="btn btn-primary"
                      onClick={() => void copyToClipboard(link)}
                    >
                      Copy
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        window.open(link, "_blank", "noopener,noreferrer")
                      }
                    >
                      Open
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Username */}
      <div
        style={{
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-primary)",
          background: "var(--bg-elevated)",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Vanity username (Premium)</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            style={{
              padding: "0.6rem 0.75rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-primary)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              minWidth: 240,
            }}
          />
          <button
            className="btn btn-primary"
            onClick={() => void handleUpdateUsername()}
            disabled={usernameBusy}
          >
            {usernameBusy ? "Saving..." : "Update"}
          </button>
        </div>
        {usernameResult && (
          <div style={{ marginTop: "0.5rem", color: "var(--success)" }}>
            Updated to: {usernameResult}
          </div>
        )}
        {usernameError && (
          <div style={{ marginTop: "0.5rem", color: "var(--danger)" }}>
            {usernameError}
          </div>
        )}
      </div>

      {/* Mode selector */}
      <div
        style={{
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-primary)",
          background: "var(--bg-elevated)",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Selected mode</h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <select
            value={selectedModeId}
            onChange={(e) => setSelectedModeId(e.target.value)}
            style={{
              padding: "0.6rem 0.75rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-primary)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              minWidth: 280,
            }}
          >
            {modes.map((m) => (
              <option key={m.modeId} value={m.modeId}>
                {m.name} ({m.slug})
              </option>
            ))}
          </select>
          {selectedMode ? (
            <div style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>
              PublicId: {selectedMode.cardPublicId}
            </div>
          ) : null}
        </div>
      </div>

      {/* B — Create mode */}
      <div
        style={{
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-primary)",
          background: "var(--bg-elevated)",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Modes</h2>
        <form
          onSubmit={handleCreateMode}
          style={{ display: "grid", gap: "0.75rem", maxWidth: 720 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
            }}
          >
            <input
              value={createMode.name}
              onChange={(e) =>
                setCreateMode((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="Mode name"
              required
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-primary)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
              }}
            />
            <input
              value={createMode.slug}
              onChange={(e) =>
                setCreateMode((p) => ({ ...p, slug: e.target.value }))
              }
              placeholder="slug (e.g. personal)"
              required
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-primary)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <input
            value={createMode.headline ?? ""}
            onChange={(e) =>
              setCreateMode((p) => ({ ...p, headline: e.target.value }))
            }
            placeholder="Headline (optional)"
            style={{
              padding: "0.6rem 0.75rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-primary)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
            }}
          />

          <textarea
            value={createMode.bio ?? ""}
            onChange={(e) =>
              setCreateMode((p) => ({ ...p, bio: e.target.value }))
            }
            placeholder="Bio (optional)"
            rows={3}
            style={{
              padding: "0.6rem 0.75rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-primary)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <select
              value={createMode.contactGate ?? "REQUEST_REQUIRED"}
              onChange={(e) =>
                setCreateMode((p) => ({
                  ...p,
                  contactGate: e.target.value as any,
                }))
              }
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-primary)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
              }}
            >
              <option value="REQUEST_REQUIRED">Request required</option>
              <option value="OPEN">Open</option>
              <option value="HIDDEN">Hidden</option>
            </select>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "var(--text-secondary)",
              }}
            >
              <input
                type="checkbox"
                checked={createMode.indexingEnabled ?? true}
                onChange={(e) =>
                  setCreateMode((p) => ({
                    ...p,
                    indexingEnabled: e.target.checked,
                  }))
                }
              />
              Indexing enabled
            </label>
          </div>

          {createModeError && (
            <div style={{ color: "var(--danger)" }}>{createModeError}</div>
          )}

          <div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={createModeBusy}
            >
              {createModeBusy ? "Creating..." : "Create mode"}
            </button>
          </div>
        </form>
      </div>

      {/* C — Requests */}
      <div
        style={{
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-primary)",
          background: "var(--bg-elevated)",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Requests inbox</h2>

        {requestsBusy ? (
          <Loading size="small" message="Loading requests..." />
        ) : requestsError ? (
          <div style={{ color: "var(--danger)" }}>{requestsError}</div>
        ) : pendingRequests.length === 0 ? (
          <div style={{ color: "var(--text-secondary)" }}>
            No pending requests.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {pendingRequests.map((r) => {
              const busy = approveBusyId === r.id || denyBusyId === r.id;
              const choice = approveChoiceByRequestId[r.id]?.kind ?? "7";
              const customExpiresAt =
                approveChoiceByRequestId[r.id]?.customExpiresAt ?? "";

              return (
                <div
                  key={r.id}
                  style={{
                    border: "1px solid var(--border-primary)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-primary)",
                    padding: "0.75rem",
                    display: "grid",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{r.requesterName}</div>
                    <div
                      style={{
                        color: "var(--text-tertiary)",
                        fontSize: "0.85rem",
                      }}
                    >
                      {formatDateTime(r.createdAt)}
                    </div>
                  </div>

                  <div
                    style={{
                      color: "var(--text-tertiary)",
                      fontSize: "0.85rem",
                    }}
                  >
                    {r.requesterEmail}
                    {r.requesterPhone ? ` • ${r.requesterPhone}` : ""}
                  </div>

                  {r.message ? (
                    <div
                      style={{
                        color: "var(--text-secondary)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {r.message}
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <select
                      value={choice}
                      onChange={(e) =>
                        setApproveChoiceByRequestId((prev) => ({
                          ...prev,
                          [r.id]: { kind: e.target.value as any },
                        }))
                      }
                      style={{
                        padding: "0.5rem 0.6rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-primary)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="7">Approve (7 days)</option>
                      <option value="30">Approve (30 days)</option>
                      <option value="custom">Custom expiry (Premium)</option>
                    </select>

                    {choice === "custom" ? (
                      <input
                        type="datetime-local"
                        value={customExpiresAt}
                        onChange={(e) =>
                          setApproveChoiceByRequestId((prev) => ({
                            ...prev,
                            [r.id]: {
                              kind: "custom",
                              customExpiresAt: e.target.value,
                            },
                          }))
                        }
                        style={{
                          padding: "0.5rem 0.6rem",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-primary)",
                          background: "var(--bg-primary)",
                          color: "var(--text-primary)",
                        }}
                      />
                    ) : null}

                    <button
                      className="btn btn-primary"
                      onClick={() => void approveRequest(r.id)}
                      disabled={busy}
                      type="button"
                    >
                      {approveBusyId === r.id ? "Approving..." : "Approve"}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => void denyRequest(r.id)}
                      disabled={busy}
                      type="button"
                    >
                      {denyBusyId === r.id ? "Denying..." : "Deny"}
                    </button>
                  </div>

                  <div
                    style={{
                      color: "var(--text-tertiary)",
                      fontSize: "0.8rem",
                    }}
                  >
                    Email/phone are shown only in this list, never in toasts.
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {lastGrant ? (
          <div
            style={{
              marginTop: "1rem",
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-primary)",
              padding: "0.75rem",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              Approved token (copy once)
            </div>
            <div style={{ color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
              Expires: {formatDateTime(lastGrant.expiresAt)}
            </div>

            <div
              style={{
                marginTop: "0.5rem",
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setShowGrantToken((v) => !v)}
                data-testid="card-grant-toggle"
              >
                {showGrantToken ? "Hide" : "Show"}
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void copyToClipboard(lastGrant.token)}
                data-testid="card-grant-copy"
              >
                Copy token
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={revokeGrantBusy}
                onClick={() => void revokeLastGrant()}
                data-testid="card-grant-revoke"
              >
                {revokeGrantBusy ? "Revoking..." : "Revoke grant"}
              </button>
            </div>

            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-primary)",
                background: "var(--bg-elevated)",
                color: "var(--text-secondary)",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                fontSize: "0.85rem",
                overflowX: "auto",
              }}
              data-testid="card-grant-token"
            >
              {showGrantToken ? lastGrant.token : maskToken(lastGrant.token)}
            </div>
          </div>
        ) : null}
      </div>

      {/* D — Attachments */}
      <div
        style={{
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-primary)",
          background: "var(--bg-elevated)",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Attachments</h2>

        {attachmentsBusy ? (
          <Loading size="small" message="Loading attachments..." />
        ) : null}
        {attachmentsError ? (
          <div style={{ color: "var(--danger)" }}>{attachmentsError}</div>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginBottom: "0.75rem",
          }}
        >
          <input
            value={addAlbum.albumId}
            onChange={(e) =>
              setAddAlbum((p) => ({ ...p, albumId: e.target.value }))
            }
            placeholder="Album ID"
            style={{
              padding: "0.6rem 0.75rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-primary)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              minWidth: 240,
            }}
          />
          <input
            value={addAlbum.label}
            onChange={(e) =>
              setAddAlbum((p) => ({ ...p, label: e.target.value }))
            }
            placeholder="Label (optional)"
            style={{
              padding: "0.6rem 0.75rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-primary)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              minWidth: 240,
            }}
          />
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void addAlbumAttachment()}
            disabled={addAlbumBusy}
          >
            {addAlbumBusy ? "Adding..." : "Add album"}
          </button>
        </div>

        {attachments.length === 0 ? (
          <div style={{ color: "var(--text-secondary)" }}>
            No attachments yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {attachments.map((a) => (
              <AttachmentRow
                key={a.id}
                attachment={a}
                onMoveUp={() => void moveAttachment(a.id, -1)}
                onMoveDown={() => void moveAttachment(a.id, 1)}
                onRevoke={() => void revokeAttachment(a.id)}
                onDelete={() => void deleteAttachment(a.id)}
                onSaveLabel={(label) => void saveAttachmentLabel(a.id, label)}
              />
            ))}
          </div>
        )}
      </div>

      {/* E — Analytics */}
      <div
        style={{
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-primary)",
          background: "var(--bg-elevated)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Analytics</h2>
        {analyticsBusy ? (
          <Loading size="small" message="Loading analytics..." />
        ) : analyticsError ? (
          <div style={{ color: "var(--danger)" }}>{analyticsError}</div>
        ) : !analytics ? (
          <div style={{ color: "var(--text-secondary)" }}>
            No analytics yet.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <Stat label="Views" value={String(analytics.viewsTotal)} />
            <Stat
              label="Last viewed"
              value={formatDateTime(analytics.lastViewedAt)}
            />
            <Stat
              label="Requests"
              value={String(analytics.contactRequestsTotal)}
            />
            <Stat label="Approvals" value={String(analytics.approvalsTotal)} />
            <Stat label="Denials" value={String(analytics.denialsTotal)} />
            <Stat
              label="Active grants"
              value={String(analytics.activeGrantsTotal)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      border: "1px solid var(--border-primary)",
      borderRadius: "var(--radius-md)",
      background: "var(--bg-primary)",
      padding: "0.75rem",
    }}
  >
    <div style={{ color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
      {label}
    </div>
    <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>{value}</div>
  </div>
);

const AttachmentRow: React.FC<{
  attachment: CardAttachmentResponse;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRevoke: () => void;
  onDelete: () => void;
  onSaveLabel: (label: string) => void;
}> = ({
  attachment,
  onMoveUp,
  onMoveDown,
  onRevoke,
  onDelete,
  onSaveLabel,
}) => {
  const [label, setLabel] = useState(attachment.label ?? "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLabel(attachment.label ?? "");
  }, [attachment.label]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveLabel(label);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-primary)",
        padding: "0.75rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "0.75rem",
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>
          {attachment.kind} • {attachment.refId}
        </div>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginTop: "0.5rem",
          }}
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            style={{
              padding: "0.5rem 0.6rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-primary)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              minWidth: 220,
            }}
          />
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
        <div
          style={{
            marginTop: "0.5rem",
            color: "var(--text-tertiary)",
            fontSize: "0.8rem",
          }}
        >
          sortOrder: {attachment.sortOrder} • revoked:{" "}
          {attachment.revokedAt ? "yes" : "no"}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <button className="btn btn-secondary" type="button" onClick={onMoveUp}>
          Up
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={onMoveDown}
        >
          Down
        </button>
        <button className="btn btn-secondary" type="button" onClick={onRevoke}>
          Revoke
        </button>
        <button className="btn btn-secondary" type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
};
