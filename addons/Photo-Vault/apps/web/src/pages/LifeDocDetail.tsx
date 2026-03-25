import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LifeDocReminderSetting } from "@booster-vault/shared";
import type {
  LifeDocResponse,
  LifeDocVersionsResponse,
  LifeDocVersionItem,
  MediaResponse,
} from "@booster-vault/shared";
import { lifeDocsApi } from "../api/lifeDocs";
import { mediaApi } from "../api/media";
import { Loading } from "../components/Loading";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { MediaViewer } from "../components/MediaViewer";
import { useToast } from "../components/ToastProvider";
import {
  canManageLifeDoc,
  categoryLabel,
  effectiveSubcategoryLabel,
  reminderSettingLabel,
  statusColor,
  statusLabel,
  visibilityLabel,
} from "../utils/lifeDocs";

export const LifeDocDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [doc, setDoc] = useState<LifeDocResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const [maskedRevealed, setMaskedRevealed] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [pendingOpenAfterReveal, setPendingOpenAfterReveal] = useState(false);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerMedia, setViewerMedia] = useState<MediaResponse | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  const [versions, setVersions] = useState<LifeDocVersionsResponse | null>(
    null,
  );
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);

  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<LifeDocVersionItem | null>(
    null,
  );
  const [isRestoring, setIsRestoring] = useState(false);

  const [reminderSetting, setReminderSetting] =
    useState<LifeDocReminderSetting | null>(null);
  const [reminderCustomDaysInput, setReminderCustomDaysInput] =
    useState<string>("");
  const [quietHoursStart, setQuietHoursStart] = useState<string>("");
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>("");
  const [notifySharedMembers, setNotifySharedMembers] =
    useState<boolean>(false);
  const [isSavingReminders, setIsSavingReminders] = useState(false);

  const [privacyMaskedMode, setPrivacyMaskedMode] = useState<boolean>(false);
  const [privacyHideExpiry, setPrivacyHideExpiry] = useState<boolean>(true);
  const [privacyAliasTitle, setPrivacyAliasTitle] = useState<string>("");
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  const canManage = useMemo(() => {
    if (!doc) return false;
    return canManageLifeDoc(doc.viewerRole);
  }, [doc]);

  const reload = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await lifeDocsApi.get(id);
      setDoc(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load Life Doc");
      setDoc(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMaskedRevealed(false);
    setConfirmReveal(false);
    setPendingOpenAfterReveal(false);
    void reload();
  }, [id]);

  useEffect(() => {
    if (!doc) return;
    setReminderSetting(doc.reminderSetting);
    setReminderCustomDaysInput(
      Array.isArray(doc.reminderCustomDays) && doc.reminderCustomDays.length > 0
        ? doc.reminderCustomDays.join(", ")
        : "",
    );
    setQuietHoursStart(String(doc.quietHours?.start ?? "") || "");
    setQuietHoursEnd(String(doc.quietHours?.end ?? "") || "");
    setNotifySharedMembers(!!doc.notifySharedMembers);

    setPrivacyMaskedMode(!!doc.maskedMode);
    setPrivacyHideExpiry(
      doc.maskedHideExpiry === undefined ? true : !!doc.maskedHideExpiry,
    );
    setPrivacyAliasTitle(String(doc.aliasTitle ?? "") || "");
  }, [doc?.id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setVersionsLoading(true);
    setVersionsError(null);
    void (async () => {
      try {
        const res = await lifeDocsApi.getVersions(id);
        if (cancelled) return;
        setVersions(res);
      } catch (e: any) {
        if (cancelled) return;
        setVersions(null);
        setVersionsError(e?.message || "Failed to load versions");
      } finally {
        if (!cancelled) setVersionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isMaskedLocked = useMemo(() => {
    return !!doc?.maskedMode && !maskedRevealed;
  }, [doc, maskedRevealed]);

  const maskedTitle = (d: LifeDocResponse): string => {
    if (!d.maskedMode) return d.title;
    const alias = String(d.aliasTitle ?? "").trim();
    return alias || "Private document";
  };

  const maskedExpiry = (d: LifeDocResponse): string => {
    if (!d.maskedMode) return d.expiryDate ?? "—";
    if (d.maskedHideExpiry) return "Expiry hidden";
    return d.expiryDate ?? "—";
  };

  const handleArchive = async () => {
    if (!id) return;
    setIsArchiving(true);
    try {
      await lifeDocsApi.archive(id);
      toast.success("Archived", "Life Doc archived.");
      await reload();
    } catch (e: any) {
      toast.danger("Archive failed", e?.message || "Failed to archive");
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await lifeDocsApi.delete(id);
      toast.success("Deleted", "Life Doc deleted.");
      navigate("/apps/life-docs");
    } catch (e: any) {
      toast.danger("Delete failed", e?.message || "Failed to delete");
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const openFile = async (d: LifeDocResponse) => {
    if (!d?.vaultMediaId) return;
    setViewerLoading(true);
    try {
      const m = await mediaApi.get(d.vaultMediaId);
      setViewerMedia(m as any);
      setViewerOpen(true);
    } catch (e: any) {
      toast.danger("Unable to open file", e?.message || "Failed to load media");
    } finally {
      setViewerLoading(false);
    }
  };

  const requestReveal = (opts?: { openAfter?: boolean }) => {
    setPendingOpenAfterReveal(!!opts?.openAfter);
    setConfirmReveal(true);
  };

  const confirmRevealAndMaybeOpen = async () => {
    if (!doc) return;
    const shouldOpen = pendingOpenAfterReveal;
    setMaskedRevealed(true);
    setConfirmReveal(false);
    setPendingOpenAfterReveal(false);
    if (shouldOpen) {
      await openFile(doc);
    }
  };

  const parseReminderCustomDays = (raw: string): number[] | null => {
    const parts = raw
      .split(/[,\s]+/g)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return null;
    const nums = parts
      .map((p) => Number.parseInt(p, 10))
      .filter((n) => Number.isFinite(n) && !Number.isNaN(n));
    const bounded = nums
      .map((n) => Math.max(0, Math.min(3650, n)))
      .filter((n) => Number.isInteger(n));
    const unique = Array.from(new Set(bounded));
    unique.sort((a, b) => b - a);
    return unique.length > 0 ? unique : null;
  };

  const saveReminders = async () => {
    if (!id || !doc) return;
    setIsSavingReminders(true);
    try {
      const customDays = parseReminderCustomDays(reminderCustomDaysInput);
      const qs = quietHoursStart.trim();
      const qe = quietHoursEnd.trim();
      const quietHours =
        qs || qe ? { start: qs || null, end: qe || null } : null;

      await lifeDocsApi.updateReminders(id, {
        reminderSetting: reminderSetting ?? undefined,
        reminderCustomDays: customDays,
        quietHours,
        notifySharedMembers,
      } as any);

      toast.success("Saved", "Reminder settings updated.");
      await reload();
    } catch (e: any) {
      toast.danger("Save failed", e?.message || "Failed to update reminders");
    } finally {
      setIsSavingReminders(false);
    }
  };

  const savePrivacy = async () => {
    if (!id || !doc) return;
    setIsSavingPrivacy(true);
    try {
      await lifeDocsApi.updateMaskedPrivacy(id, {
        maskedMode: privacyMaskedMode,
        maskedHideExpiry: privacyHideExpiry,
        aliasTitle: privacyAliasTitle.trim() ? privacyAliasTitle.trim() : null,
      } as any);

      toast.success("Saved", "Privacy settings updated.");
      if (privacyMaskedMode) {
        setMaskedRevealed(false);
      }
      await reload();
    } catch (e: any) {
      toast.danger("Save failed", e?.message || "Failed to update privacy");
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  const requestRestore = (v: LifeDocVersionItem) => {
    setRestoreTarget(v);
    setConfirmRestore(true);
  };

  const confirmRestoreNow = async () => {
    if (!id || !restoreTarget) return;
    setIsRestoring(true);
    try {
      await lifeDocsApi.restoreVersion(id, restoreTarget.versionId);
      toast.success("Restored", "Version restored.");
      setConfirmRestore(false);
      setRestoreTarget(null);
      await reload();
      const res = await lifeDocsApi.getVersions(id);
      setVersions(res);
    } catch (e: any) {
      toast.danger("Restore failed", e?.message || "Failed to restore version");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleViewFile = async () => {
    if (!doc?.vaultMediaId) return;
    if (isMaskedLocked) {
      requestReveal({ openAfter: true });
      return;
    }
    await openFile(doc);
  };

  if (isLoading) return <Loading message="Loading Life Doc..." />;

  if (!doc) {
    return (
      <div
        className="lifeDocsPage"
        style={{ maxWidth: "800px", marginTop: "100px", textAlign: "center" }}
      >
        <div
          style={{
            padding: "var(--space-6)",
            background: "var(--danger-light)",
            color: "var(--danger)",
            borderRadius: "var(--radius-lg)",
            marginBottom: "var(--space-6)",
            border: "1px solid var(--danger)",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", marginBottom: "var(--space-2)" }}>
            Document Not Found
          </h2>
          <p>{error || "We couldn't find the document you're looking for."}</p>
        </div>
        <Link to="/apps/life-docs" className="btn btn-secondary">
          ← Back to Documents
        </Link>
      </div>
    );
  }

  const DetailItem = ({
    label,
    value,
    highlight = false,
  }: {
    label: string;
    value: React.ReactNode;
    highlight?: boolean;
  }) => (
    <div className="lifeDocsDataGroup">
      <div className="lifeDocsDataLabel">{label}</div>
      <div
        className={`lifeDocsDataValue ${highlight ? "lifeDocsDataValue--highlight" : ""}`}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div className="lifeDocsPage">
      {/* Breadcrumb / Back */}
      <div
        style={{
          marginBottom: "var(--space-6)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link to="/apps/life-docs" className="lifeDocsBackLink">
          <span style={{ fontSize: "1.1em" }}>←</span> Back to Life Docs
        </Link>
      </div>

      {/* Hero */}
      <div
        className="lifeDocsHero lifeDocsHero--compact"
        style={{ marginBottom: "var(--space-8)" }}
      >
        <div className="lifeDocsHeroInner">
          <div style={{ flex: "1 1 auto", minWidth: 260 }}>
            <div
              className="lifeDocDetailMetaRow"
              style={{ marginBottom: "var(--space-4)" }}
            >
              <span
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius-full)",
                  background: isMaskedLocked
                    ? "color-mix(in srgb, var(--bg-elevated) 80%, transparent)"
                    : `color-mix(in srgb, ${statusColor(doc.status)} 12%, transparent)`,
                  color: isMaskedLocked
                    ? "var(--text-secondary)"
                    : statusColor(doc.status),
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  border: isMaskedLocked
                    ? "1px solid var(--border-primary)"
                    : `1px solid color-mix(in srgb, ${statusColor(doc.status)} 25%, transparent)`,
                }}
              >
                {isMaskedLocked
                  ? "MASKED"
                  : statusLabel(doc.status).toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  background: "var(--bg-secondary)",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-lg)",
                }}
              >
                {categoryLabel(doc.category)}{" "}
                <span style={{ opacity: 0.5, margin: "0 4px" }}>/</span>{" "}
                {effectiveSubcategoryLabel(
                  doc.subcategory,
                  doc.customSubcategory,
                )}
              </span>
              <span
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  background: "var(--bg-secondary)",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-lg)",
                }}
              >
                {visibilityLabel(doc.visibility)}
              </span>
            </div>

            <h1
              className="lifeDocsHeroTitle"
              style={{ margin: "0 0 var(--space-4) 0" }}
            >
              {isMaskedLocked ? maskedTitle(doc) : doc.title}
            </h1>

            {doc.maskedMode ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-4)",
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px dashed var(--border-primary)",
                  background: "var(--bg-elevated)",
                }}
              >
                <div
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.95rem",
                    fontWeight: 500,
                  }}
                >
                  <span style={{ marginRight: 6 }}>🔒</span>
                  Masked mode is enabled
                </div>
                {isMaskedLocked ? (
                  <button
                    onClick={() => requestReveal({ openAfter: false })}
                    className="btn btn-primary"
                    style={{ padding: "6px 14px", fontSize: "0.9rem" }}
                  >
                    Reveal
                  </button>
                ) : (
                  <span
                    style={{
                      color: "var(--text-tertiary)",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                    }}
                  >
                    Revealed
                  </span>
                )}
              </div>
            ) : null}
          </div>

          <div
            className="lifeDocDetailActions"
            style={{ alignSelf: "flex-end", display: "flex", gap: "10px" }}
          >
            {canManage && (
              <>
                <Link
                  to={`/apps/life-docs/${doc.id}/edit`}
                  className="btn btn-secondary"
                >
                  Edit
                </Link>
                <Link
                  to={`/apps/life-docs/${doc.id}/replace`}
                  className="btn btn-secondary"
                >
                  Replace
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="lifeDocsGrid">
        <div className="lifeDocsMainColumn">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-6)",
            }}
          >
            {/* Main Details Card */}
            <div className="lifeDocsCard">
              <div className="lifeDocsCardHeader">
                <h3 className="lifeDocsCardTitle">Document Details</h3>
                <div
                  style={{
                    color: "var(--text-tertiary)",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                  }}
                >
                  ID: {doc.id.slice(0, 8)}...
                </div>
              </div>

              <div
                className="lifeDocsDataGrid"
                style={{ marginBottom: "var(--space-6)" }}
              >
                <div style={{ gridColumn: "1 / -1" }}>
                  <DetailItem
                    label="Issuing Authority"
                    value={doc.issuingAuthority || "—"}
                    highlight
                  />
                </div>

                <DetailItem label="Issued Date" value={doc.issueDate || "—"} />

                {/* Expiry Special */}
                <div className="lifeDocsDataGroup">
                  <div className="lifeDocsDataLabel">Expiry Date</div>
                  <div
                    className={`lifeDocsDataValue ${
                      doc.expiryDate && Date.parse(doc.expiryDate) < Date.now()
                        ? "text-danger"
                        : ""
                    }`}
                    style={{
                      color: isMaskedLocked
                        ? "var(--text-secondary)"
                        : doc.expiryDate &&
                            Date.parse(doc.expiryDate) < Date.now()
                          ? "var(--danger)"
                          : "var(--text-primary)",
                    }}
                  >
                    {isMaskedLocked ? maskedExpiry(doc) : doc.expiryDate || "—"}
                  </div>
                </div>

                <DetailItem
                  label="Renewal Required"
                  value={doc.renewalRequired ? "Yes" : "No"}
                />
              </div>

              {/* Reminder Summary Section Inside Details */}
              <div
                style={{
                  background: "var(--bg-secondary)",
                  padding: "var(--space-5)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-4)",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: "var(--bg-element)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  🔔
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Reminder Schedule
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {reminderSettingLabel(doc.reminderSetting)}
                  </div>
                </div>
              </div>
            </div>

            {/* Versions Card */}
            <div
              className={`lifeDocsCard ${isMaskedLocked ? "lifeDocsMaskedContent" : ""}`}
            >
              {isMaskedLocked && (
                <div className="lifeDocsMaskedOverlay">
                  <span style={{ fontSize: "2rem" }}>🔒</span>
                  <div className="lifeDocsMaskedOverlayMessage">
                    Verify your identity to view version history
                  </div>
                </div>
              )}

              <div className="lifeDocsCardHeader">
                <h3 className="lifeDocsCardTitle">Version History</h3>
              </div>

              {versionsLoading ? (
                <div style={{ color: "var(--text-secondary)" }}>
                  Loading versions…
                </div>
              ) : versionsError ? (
                <div style={{ color: "var(--danger)", fontWeight: 700 }}>
                  {versionsError}
                </div>
              ) : !versions || versions.versions.length === 0 ? (
                <div style={{ color: "var(--text-secondary)" }}>
                  No versions found.
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                  }}
                >
                  {versions.versions.map((v) => (
                    <div key={v.versionId} className="lifeDocsVersionItem">
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                          {v.isLatest ? "Current Version" : "Previous Version"}
                          <span
                            style={{
                              fontWeight: 400,
                              color: "var(--text-tertiary)",
                              marginLeft: 8,
                            }}
                          >
                            • {new Date(v.uploadTimestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <div
                          style={{
                            color: "var(--text-tertiary)",
                            fontSize: "0.85rem",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {v.fileHash.slice(0, 12)}
                        </div>
                      </div>

                      {canManage && !v.isLatest ? (
                        <button
                          onClick={() => requestRestore(v)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                        >
                          Restore
                        </button>
                      ) : v.isLatest ? (
                        <span className="badge badge-success">Latest</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lifeDocsSideColumn">
          {/* File Preview Card */}
          <div
            className={`lifeDocsCard lifeDocsFileCard ${isMaskedLocked ? "lifeDocsMaskedContent" : ""}`}
          >
            {isMaskedLocked && (
              <div className="lifeDocsMaskedOverlay">
                <span style={{ fontSize: "3rem" }}>🔒</span>
              </div>
            )}

            <div className="lifeDocsFileIcon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <h3
              style={{
                fontSize: "1.25rem",
                marginBottom: "var(--space-2)",
                color: "var(--text-primary)",
                fontWeight: 700,
              }}
            >
              Encrypted Document
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.95rem",
                marginBottom: "var(--space-8)",
                maxWidth: "240px",
                lineHeight: 1.5,
              }}
            >
              This file is stored in your secure Vault with end-to-end
              encryption.
            </p>
            <button
              onClick={handleViewFile}
              disabled={viewerLoading}
              className="btn btn-primary"
              style={{
                width: "100%",
                maxWidth: "240px",
                padding: "12px",
                fontSize: "1rem",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              {viewerLoading
                ? "Decrypting..."
                : isMaskedLocked
                  ? "Reveal to View"
                  : "View Document"}
            </button>
          </div>

          {/* Privacy Controls */}
          {canManage && (
            <div className="lifeDocsCard">
              <div className="lifeDocsCardHeader">
                <h3 className="lifeDocsCardTitle">Privacy Settings</h3>
              </div>

              <div
                className="lifeDocsCheckbox"
                onClick={() => setPrivacyMaskedMode(!privacyMaskedMode)}
              >
                <input
                  type="checkbox"
                  checked={privacyMaskedMode}
                  readOnly
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontWeight: 600 }}>Enable Masked Mode</span>
              </div>

              <div style={{ height: "12px" }}></div>

              {privacyMaskedMode && (
                <>
                  <div
                    className="lifeDocsCheckbox"
                    onClick={() => setPrivacyHideExpiry(!privacyHideExpiry)}
                    style={{ height: "auto" }}
                  >
                    <input
                      type="checkbox"
                      checked={privacyHideExpiry}
                      readOnly
                      style={{ cursor: "pointer" }}
                    />
                    <span style={{ fontWeight: 600 }}>Hide Expiry Date</span>
                  </div>

                  <div
                    className="lifeDocsInputGroup"
                    style={{ marginTop: "var(--space-4)" }}
                  >
                    <label className="lifeDocsInputLabel">
                      Alias Title (Optional)
                    </label>
                    <input
                      className="lifeDocsInput"
                      placeholder="e.g. Travel Document"
                      value={privacyAliasTitle}
                      onChange={(e) => setPrivacyAliasTitle(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div
                style={{
                  marginTop: "auto",
                  paddingTop: "var(--space-4)",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={savePrivacy}
                  disabled={isSavingPrivacy}
                  className="btn btn-primary btn-sm"
                >
                  {isSavingPrivacy ? "Saving..." : "Save Privacy"}
                </button>
              </div>
            </div>
          )}

          {/* Detailed Reminders */}
          {canManage && (
            <div
              className={`lifeDocsCard ${isMaskedLocked ? "lifeDocsMaskedContent" : ""}`}
            >
              {isMaskedLocked && (
                <div className="lifeDocsMaskedOverlay">
                  <div className="lifeDocsMaskedOverlayMessage">
                    Reveal to edit reminders
                  </div>
                </div>
              )}

              <div className="lifeDocsCardHeader">
                <h3 className="lifeDocsCardTitle">Reminder Config</h3>
              </div>

              <div className="lifeDocsInputGroup">
                <label className="lifeDocsInputLabel">Frequency</label>
                <select
                  value={reminderSetting ?? ""}
                  onChange={(e) => setReminderSetting(e.target.value as any)}
                  className="lifeDocsInput"
                >
                  {Object.values(LifeDocReminderSetting).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="lifeDocsCheckbox"
                onClick={() => setNotifySharedMembers(!notifySharedMembers)}
              >
                <input type="checkbox" checked={notifySharedMembers} readOnly />
                <span style={{ fontWeight: 600 }}>Notify shared members</span>
              </div>

              <div style={{ height: "12px" }}></div>

              <div className="lifeDocsInputGroup">
                <label className="lifeDocsInputLabel">
                  Custom days (comma sep)
                </label>
                <input
                  type="text"
                  value={reminderCustomDaysInput}
                  onChange={(e) => setReminderCustomDaysInput(e.target.value)}
                  placeholder="90, 30, 7, 0"
                  className="lifeDocsInput"
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                }}
              >
                <div className="lifeDocsInputGroup">
                  <label className="lifeDocsInputLabel">Quiet Start</label>
                  <input
                    type="text"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                    placeholder="HH:mm"
                    className="lifeDocsInput"
                  />
                </div>
                <div className="lifeDocsInputGroup">
                  <label className="lifeDocsInputLabel">Quiet End</label>
                  <input
                    type="text"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                    placeholder="HH:mm"
                    className="lifeDocsInput"
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: "auto",
                  paddingTop: "var(--space-4)",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={saveReminders}
                  disabled={isSavingReminders}
                  className="btn btn-primary btn-sm"
                >
                  {isSavingReminders ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </div>
          )}

          {canManage && (
            <div
              className="lifeDocsCard"
              style={{
                borderColor: "var(--border-secondary)",
                boxShadow: "none",
                background: "transparent",
              }}
            >
              <h4
                style={{
                  margin: "0 0 var(--space-4)",
                  color: "var(--text-secondary)",
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Danger Zone
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                <button
                  onClick={handleArchive}
                  disabled={isArchiving || doc.status === "ARCHIVED"}
                  className="btn btn-secondary"
                  style={{
                    justifyContent: "flex-start",
                    borderColor: "var(--border-secondary)",
                  }}
                >
                  {isArchiving ? "Archiving..." : "Archive Document"}
                </button>

                <button
                  onClick={() => setConfirmDelete(true)}
                  className="btn btn-danger"
                  style={{
                    justifyContent: "flex-start",
                    background: "transparent",
                    border: "1px solid var(--danger)",
                    color: "var(--danger)",
                  }}
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: "var(--space-8)",
          textAlign: "center",
          color: "var(--text-tertiary)",
          fontSize: "0.85rem",
        }}
      >
        Reminders are for assistance only. You remain responsible for ensuring
        your documents are renewed on time.
      </div>

      <ConfirmationModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete Life Doc?"
        message={
          "This deletes the Life Doc record only. Your encrypted Vault file remains unless you delete it from the Library."
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDestructive
        isLoading={isDeleting}
      />

      <ConfirmationModal
        open={confirmReveal}
        onClose={() => {
          setConfirmReveal(false);
          setPendingOpenAfterReveal(false);
        }}
        onConfirm={confirmRevealAndMaybeOpen}
        title="Reveal masked details?"
        message={
          "This will reveal the document title and any visible expiry metadata on this screen."
        }
        confirmLabel="Reveal"
        cancelLabel="Cancel"
      />

      <ConfirmationModal
        open={confirmRestore}
        onClose={() => {
          setConfirmRestore(false);
          setRestoreTarget(null);
        }}
        onConfirm={confirmRestoreNow}
        title="Restore this version?"
        message={
          restoreTarget
            ? `This will make the selected version the latest. Version: ${new Date(restoreTarget.uploadTimestamp).toLocaleString()}`
            : "This will make the selected version the latest."
        }
        confirmLabel="Restore"
        cancelLabel="Cancel"
        isLoading={isRestoring}
        isDestructive
      />

      {viewerMedia && (
        <MediaViewer
          media={viewerMedia as any}
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          disableTrash
          onRefresh={() => undefined}
        />
      )}
    </div>
  );
};
