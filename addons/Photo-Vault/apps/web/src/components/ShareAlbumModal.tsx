import React, { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { sharingApi } from "../api/sharing";
import { albumsApi } from "../api/albums";
import type { ShareAnalyticsResponse } from "@booster-vault/shared";
import { useToast } from "./ToastProvider";
import { getWrappedKey } from "../crypto/keyStore";
import { getCachedMasterKey } from "../crypto/vaultKey";
import {
  generatePassphrase,
  prepareShareBundle,
  generateKdfParams,
} from "../crypto/sharing";
import { unwrapKey } from "../crypto/webcrypto";

// --- Icons ---
const ShareIcon = () => (
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
    <circle cx="18" cy="5" r="3"></circle>
    <circle cx="6" cy="12" r="3"></circle>
    <circle cx="18" cy="19" r="3"></circle>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
  </svg>
);

const CopyIcon = () => (
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
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

interface ShareAlbumModalProps {
  albumId: string;
  open: boolean;
  onClose: (shareCreated?: {
    shareLink: string;
    sharePassphrase: string;
  }) => void;
}

export const ShareAlbumModal: React.FC<ShareAlbumModalProps> = ({
  albumId,
  open,
  onClose,
}) => {
  const [step, setStep] = useState<
    | "warning"
    | "generating"
    | "encrypting"
    | "creatingStub"
    | "uploadingBundle"
    | "complete"
  >("warning");
  const [album, setAlbum] = useState<any>(null);
  const [albumItems, setAlbumItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [createdShareId, setCreatedShareId] = useState<string>("");
  const [shareLink, setShareLink] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [analytics, setAnalytics] = useState<ShareAnalyticsResponse | null>(
    null,
  );
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      loadAlbumDetails();
    } else {
      resetState();
    }
  }, [open]);

  const loadAlbumDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [albumData, itemsData] = await Promise.all([
        albumsApi.get(albumId),
        albumsApi.listItems(albumId, { limit: 100 }),
      ]);
      setAlbum(albumData);
      setAlbumItems(
        Array.isArray(itemsData?.items)
          ? itemsData.items.map((item: any) => item.media)
          : [],
      );
    } catch (err: any) {
      setError(err.message || "Failed to load album details");
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setStep("warning");
    setAlbum(null);
    setAlbumItems([]);
    setIsLoading(false);
    setError(null);
    setPassphrase("");
    setCreatedShareId("");
    setShareLink("");
    setExpiresInDays(7);
    setCopiedLink(false);
    setCopiedPass(false);
    setAnalytics(null);
    setAnalyticsLoading(false);
    setAnalyticsError(null);
  };

  const loadAnalytics = async (shareId: string) => {
    if (!shareId) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const result = await sharingApi.getAnalytics(shareId);
      setAnalytics(result);
    } catch (err: any) {
      setAnalyticsError(err?.message || "Failed to load analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (step !== "complete") return;
    if (!createdShareId) return;
    loadAnalytics(createdShareId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, createdShareId]);

  const checkVaultUnlocked = async (): Promise<boolean> => {
    try {
      const masterKey = getCachedMasterKey();
      return !!masterKey;
    } catch {
      return false;
    }
  };

  const getMediaKey = async (mediaId: string): Promise<CryptoKey | null> => {
    try {
      const wrapped = await getWrappedKey(mediaId);
      if (!wrapped) {
        return null;
      }
      const masterKey = getCachedMasterKey();
      return await unwrapKey(wrapped.wrappedKey, masterKey, wrapped.wrapIv);
    } catch (err) {
      console.warn(`Failed to get media key for ${mediaId}:`, err);
      return null;
    }
  };

  const handleGeneratePassphrase = () => {
    const pass = generatePassphrase();
    setPassphrase(pass);
    setStep("generating");
  };

  const handleCreateShare = async () => {
    if (!album || !Array.isArray(albumItems) || albumItems.length === 0) {
      setError("Album has no media items to share");
      return;
    }

    // Check vault is unlocked
    const vaultUnlocked = await checkVaultUnlocked();
    if (!vaultUnlocked) {
      setError("Vault must be unlocked to create a share");
      return;
    }

    setStep("encrypting");
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Get media keys from keyStore
      const mediaKeys = [];
      for (const item of albumItems) {
        try {
          const mediaKey = await getMediaKey(item.id);
          if (mediaKey) {
            mediaKeys.push({ mediaId: item.id, mediaKey });
          } else {
            console.warn(`No key found for media ${item.id}`);
          }
        } catch (err) {
          console.warn(`Failed to get key for media ${item.id}:`, err);
        }
      }

      if (!Array.isArray(mediaKeys) || mediaKeys.length === 0) {
        throw new Error("No media keys available for sharing");
      }

      // Step 2: Generate KDF params and prepare bundle
      const kdfParams = generateKdfParams();
      const bundle = await prepareShareBundle(passphrase, mediaKeys, kdfParams);

      // Step 3: Create share stub, then upload bundle
      setStep("creatingStub");
      const stub = await sharingApi.createStub(albumId, {
        createShareDto: { expiresInDays },
      });

      try {
        setStep("uploadingBundle");
        await sharingApi.uploadBundle(stub.shareId, {
          encryptedAlbumKey: bundle.encryptedAlbumKey,
          encryptedMediaKeys: Array.isArray(bundle?.encryptedMediaKeys)
            ? bundle.encryptedMediaKeys.map((item) => ({
                mediaId: item.mediaId,
                encryptedKey: item.encryptedKey,
                iv: item.iv,
              }))
            : [],
          iv: bundle.iv,
          kdfParams,
        });
      } catch (e) {
        // Best-effort cleanup to avoid leaving a share stub around
        try {
          await sharingApi.revoke(stub.shareId);
        } catch {
          // ignore
        }
        throw e;
      }

      setShareLink(stub.shareLink);
      setCreatedShareId(stub.shareId);
      setStep("complete");
    } catch (err: any) {
      console.error("Failed to create share:", err);
      setError(err.message || "Failed to create share");
      setStep("generating");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPassphrase = () => {
    navigator.clipboard.writeText(passphrase).then(
      () => {
        setCopiedPass(true);
        setTimeout(() => setCopiedPass(false), 2000);
      },
      () => toast.danger("Copy failed", "Failed to copy passphrase"),
    );
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).then(
      () => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      },
      () => toast.danger("Copy failed", "Failed to copy link"),
    );
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={() =>
        !isLoading &&
        step !== "encrypting" &&
        step !== "creatingStub" &&
        step !== "uploadingBundle" &&
        onClose()
      }
      title="Share Encrypted Album"
      maxWidth="550px"
      showCloseButton={
        !isLoading &&
        step !== "encrypting" &&
        step !== "creatingStub" &&
        step !== "uploadingBundle" &&
        step !== "complete"
      }
    >
      <div style={{ padding: "4px 0" }}>
        {isLoading ||
        step === "encrypting" ||
        step === "creatingStub" ||
        step === "uploadingBundle" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "var(--space-8) 0",
            }}
          >
            <div
              className="loading-spinner"
              style={{ marginBottom: "var(--space-4)" }}
            />
            <p
              className="text-secondary animate-pulse"
              style={{ marginBottom: "var(--space-4)" }}
            >
              {step === "encrypting"
                ? "Encrypting album keys..."
                : step === "creatingStub"
                  ? "Creating share link..."
                  : step === "uploadingBundle"
                    ? "Uploading encrypted bundle..."
                    : "Loading..."}
            </p>

            <div
              className={`progress-bar ${
                step === "encrypting"
                  ? "progress-bar--encrypting"
                  : step === "creatingStub"
                    ? "progress-bar--creating"
                    : step === "uploadingBundle"
                      ? "progress-bar--uploading"
                      : ""
              }`}
              aria-hidden="true"
            />
          </div>
        ) : step === "warning" ? (
          <div>
            <div
              style={{ marginBottom: "var(--space-6)", textAlign: "center" }}
            >
              <div
                style={{
                  marginBottom: "var(--space-4)",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect
                    x="3"
                    y="11"
                    width="18"
                    height="11"
                    rx="2"
                    ry="2"
                  ></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h3 style={{ margin: "0 0 var(--space-2)", fontSize: "1.25rem" }}>
                End-to-End Encrypted Sharing
              </h3>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                You are about to create a secure, encrypted link for{" "}
                <strong>{album?.name}</strong>.
              </p>
            </div>

            <div
              className="banner banner-warning"
              style={{
                marginBottom: "var(--space-6)",
                padding: "var(--space-4)",
              }}
            >
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "1.5rem",
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                }}
              >
                <li>
                  Anyone with the link AND passphrase can view these photos.
                </li>
                <li>
                  We do not store the passphrase. If you lose it, the link
                  becomes useless.
                </li>
                <li>
                  Generated links expire automatically after {expiresInDays}{" "}
                  days.
                </li>
              </ul>
            </div>

            <button
              onClick={handleGeneratePassphrase}
              disabled={albumItems.length === 0}
              className="btn btn-primary"
              style={{
                width: "100%",
                justifyContent: "center",
                fontSize: "1rem",
                padding: "12px",
              }}
            >
              Generate Secure Link
            </button>
            {albumItems.length === 0 && (
              <p
                style={{
                  textAlign: "center",
                  color: "var(--danger)",
                  fontSize: "0.9rem",
                  marginTop: "var(--space-3)",
                }}
              >
                Album is empty. Add photos before sharing.
              </p>
            )}
          </div>
        ) : step === "generating" ? (
          <div>
            <h3 style={{ margin: "0 0 var(--space-3)", fontSize: "1.1rem" }}>
              1. Save this Passphrase
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.9rem",
                marginBottom: "var(--space-3)",
              }}
            >
              You must share this passphrase separately from the link (e.g., via
              Signal or in person).
            </p>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginBottom: "var(--space-6)",
                backgroundColor: "var(--bg-primary)",
                padding: "0.5rem",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-primary)",
              }}
            >
              <code
                style={{
                  flex: 1,
                  padding: "0.8rem",
                  fontFamily: "monospace",
                  fontSize: "1.1rem",
                  color: "var(--text-primary)",
                  wordBreak: "break-all",
                }}
              >
                {passphrase}
              </code>
              <button
                onClick={handleCopyPassphrase}
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "var(--radius-md)",
                  padding: "0 1rem",
                  cursor: "pointer",
                  color: copiedPass
                    ? "var(--accent-primary)"
                    : "var(--text-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {copiedPass ? "Copied!" : <CopyIcon />}
              </button>
            </div>

            <h3 style={{ margin: "0 0 var(--space-3)", fontSize: "1.1rem" }}>
              2. Link Expiration
            </h3>
            <div style={{ marginBottom: "var(--space-6)" }}>
              <label
                style={{
                  display: "block",
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  marginBottom: "0.5rem",
                }}
              >
                Link is valid for:
              </label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "0.8rem",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-primary)",
                  outline: "none",
                }}
              >
                <option value={1}>1 Day</option>
                <option value={7}>7 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                onClick={() => setStep("warning")}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Back
              </button>
              <button
                onClick={handleCreateShare}
                className="btn btn-primary"
                style={{ flex: 2, justifyContent: "center" }}
              >
                Create Link
              </button>
            </div>
          </div>
        ) : step === "complete" ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 1.5rem",
                backgroundColor: "rgba(74, 222, 128, 0.1)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-primary)",
              }}
            >
              <ShareIcon />
            </div>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
              Link Ready!
            </h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
              Share this link with your friends. Don't forget to send them the
              passphrase!
            </p>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginBottom: "2rem",
                textAlign: "left",
              }}
            >
              <input
                readOnly
                value={shareLink}
                style={{
                  flex: 1,
                  padding: "0.8rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-primary)",
                  color: "var(--text-tertiary)",
                  fontSize: "0.9rem",
                }}
              />
              <button onClick={handleCopyLink} className="btn btn-primary">
                {copiedLink ? "Copied" : "Copy"}
              </button>
            </div>

            <div
              style={{
                marginBottom: "1.25rem",
                padding: "1rem",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-primary)",
                background: "var(--bg-elevated)",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  marginBottom: "0.5rem",
                }}
              >
                <div style={{ fontWeight: 600 }}>Views</div>
                <button
                  className="btn btn-secondary"
                  onClick={() => loadAnalytics(createdShareId)}
                  disabled={analyticsLoading || !createdShareId}
                  style={{ padding: "0.4rem 0.75rem" }}
                >
                  {analyticsLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              <div
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                <div>
                  Total views: <strong>{analytics?.viewCount ?? 0}</strong>
                </div>
                <div>
                  Last viewed:{" "}
                  {analytics?.lastViewedAt
                    ? new Date(analytics.lastViewedAt).toLocaleString()
                    : "—"}
                </div>
                {analyticsError ? (
                  <div style={{ color: "var(--danger-500)" }}>
                    {analyticsError}
                  </div>
                ) : null}
              </div>
            </div>

            <button
              onClick={() =>
                onClose({ shareLink, sharePassphrase: passphrase })
              }
              className="btn btn-secondary"
              style={{ width: "100%" }}
            >
              Done
            </button>
          </div>
        ) : null}

        {error && (
          <div
            className="banner banner-danger"
            style={{
              marginTop: "var(--space-4)",
              padding: "var(--space-3)",
              fontSize: "0.9rem",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
};
