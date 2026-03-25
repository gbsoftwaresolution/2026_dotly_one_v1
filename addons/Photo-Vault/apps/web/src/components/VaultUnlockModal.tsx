import React, { useState, useEffect } from "react";
import { Modal } from "./Modal";
import {
  unlockVault,
  isMasterKeyCached,
  getCachedMasterKey,
  setCachedMasterKey,
  derivePasswordKey,
  wrapVaultMasterKey as wrapVaultMasterKeyWithPassword,
} from "../crypto/vaultKey";
import { randomBytes } from "../crypto/webcrypto";
import { RestoreVaultModal } from "./RestoreVaultModal";
import { recoveryApi } from "../api/recovery";
import { useAuth } from "../app/AuthProvider";
import {
  storeTrustedMasterKeyForDevice,
  retrieveTrustedMasterKeyForDevice,
} from "../crypto/trustedDevice";
import { vaultKeyApi } from "../api/vaultKey";
import { authApi } from "../api/auth";

interface VaultUnlockModalProps {
  open: boolean;
  onClose: () => void;
  onUnlockSuccess: () => void;
  title?: string;
  message?: string;
  showRecoveryOption?: boolean;
}

// Diagnostic error codes (for dev logs only)
enum UnlockErrorCode {
  AUTH_BOOTSTRAPPING = "AUTH_BOOTSTRAPPING",
  BUNDLE_NOT_LOADED = "BUNDLE_NOT_LOADED",
  BUNDLE_MISSING = "BUNDLE_MISSING",
  KDF_PARAMS_INVALID = "KDF_PARAMS_INVALID",
  DECRYPT_FAILED = "DECRYPT_FAILED",
  PASSWORD_WRONG_OR_CHANGED = "PASSWORD_WRONG_OR_CHANGED",
  RECOVERY_REQUIRED = "RECOVERY_REQUIRED",
}

export const VaultUnlockModal: React.FC<VaultUnlockModalProps> = ({
  open,
  onClose,
  onUnlockSuccess,
  title = "Unlock Vault",
  message = "Enter your account password to unlock your vault on this device.",
  showRecoveryOption = true,
}) => {
  const { user, isBootstrapping } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryEnabled, setRecoveryEnabled] = useState<boolean | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [bundleStatus, setBundleStatus] = useState<{
    enabled: boolean;
    loaded: boolean;
    createdAt?: string | Date;
    updatedAt?: string | Date;
  } | null>(null);
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [isResettingVault, setIsResettingVault] = useState(false);

  const isVaultNotSetUpYet =
    bundleStatus?.loaded && bundleStatus.enabled === false;

  // Check if recovery is enabled when modal opens
  useEffect(() => {
    if (open && showRecoveryOption && user) {
      checkRecoveryStatus();
    }
  }, [open, showRecoveryOption, user]);

  // Load vault key bundle status when modal opens
  useEffect(() => {
    if (open && user && !isBootstrapping) {
      loadBundleStatus();
    }
  }, [open, user, isBootstrapping]);

  // Try to restore from trusted device storage when modal opens
  useEffect(() => {
    if (open && user && !isMasterKeyCached()) {
      attemptTrustedRestore();
    }
  }, [open, user]);

  const loadBundleStatus = async () => {
    if (!user) return;
    setLoadingBundle(true);
    try {
      const status = await vaultKeyApi.getStatus();
      setBundleStatus({
        enabled: status.enabled,
        loaded: true,
        createdAt: (status as any).createdAt,
        updatedAt: (status as any).updatedAt,
      });
    } catch (err) {
      console.error("Failed to load vault key bundle status:", err);
      setBundleStatus({ enabled: false, loaded: false });
    } finally {
      setLoadingBundle(false);
    }
  };

  const looksLikePasswordChangedAfterBundle = () => {
    try {
      const bundleUpdatedAt =
        bundleStatus?.updatedAt ?? bundleStatus?.createdAt;
      const userUpdatedAt = (user as any)?.updatedAt;
      if (!bundleUpdatedAt || !userUpdatedAt) return false;

      const bundleDate = new Date(bundleUpdatedAt as any);
      const userDate = new Date(userUpdatedAt as any);
      if (
        Number.isNaN(bundleDate.getTime()) ||
        Number.isNaN(userDate.getTime())
      )
        return false;

      // If account profile updated after bundle, it *may* indicate password reset/change.
      // Keep this heuristic conservative: require a meaningful gap.
      return userDate.getTime() - bundleDate.getTime() > 2 * 60 * 1000;
    } catch {
      return false;
    }
  };

  const checkRecoveryStatus = async () => {
    if (!user) return;
    try {
      const status = await recoveryApi.getStatus();
      setRecoveryEnabled(status.enabled);
    } catch (err) {
      console.error("Failed to check recovery status:", err);
    }
  };

  const attemptTrustedRestore = async () => {
    if (!user) return;
    try {
      const restored = await retrieveTrustedMasterKeyForDevice(user.id);
      if (restored) {
        setCachedMasterKey(restored);
        onUnlockSuccess();
      }
    } catch (e) {
      // Non-fatal
      if (import.meta.env.DEV) {
        console.debug("[VaultUnlock] Trusted restore failed", e);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError(
        isVaultNotSetUpYet
          ? "Enter your account password to set up the vault."
          : "Enter your account password.",
      );
      return;
    }

    // Professional first-time setup: confirm password + verify against server
    if (isVaultNotSetUpYet) {
      if (!confirmPassword) {
        setError("Please confirm your account password.");
        return;
      }
      if (confirmPassword !== password) {
        setError("Passwords do not match.");
        return;
      }
    }

    // Bootstrap gating checks
    if (isBootstrapping) {
      setError("Please wait while we load your account...");
      return;
    }

    if (!bundleStatus?.loaded && loadingBundle) {
      setError("Loading vault configuration...");
      return;
    }

    if (!bundleStatus?.loaded) {
      setError("Vault configuration not loaded. Please try again.");
      return;
    }

    setIsUnlocking(true);
    setError(null);

    try {
      if (isVaultNotSetUpYet) {
        const result = await authApi.verifyPassword({ password });
        if (!result.valid) {
          setError(
            "That password doesn't match your account. Please try again.",
          );
          return;
        }
      }

      // 1. Derive key and unlock
      const success = await unlockVault(password);

      if (success) {
        // 2. If trust device is checked, store the key securely
        if (trustDevice && user) {
          const cachedKey = getCachedMasterKey();
          if (cachedKey) {
            try {
              await storeTrustedMasterKeyForDevice(user.id, cachedKey);
            } catch (e) {
              console.error("Failed to store trusted device key:", e);
            }
          }
        }

        setPassword("");
        setConfirmPassword("");
        onUnlockSuccess();
      } else {
        // Password wrong or changed scenario
        let errorMessage = "Couldn't unlock the vault with that password.";

        if (looksLikePasswordChangedAfterBundle()) {
          errorMessage =
            "This vault was set up with a different account password. If you recently changed your password (especially via “Forgot password”), the vault key bundle can't be decrypted with the new password.";
        }

        if (recoveryEnabled) {
          errorMessage +=
            " If you changed your password recently, restore using your recovery phrase.";
        } else {
          errorMessage +=
            " If you used “Forgot password” (password reset) and you didn't enable recovery, you'll need a recovery phrase or an existing session where the vault is already unlocked.";
        }

        setError(errorMessage);

        // Log diagnostic
        if (import.meta.env.DEV) {
          console.debug("[VaultUnlock]", {
            code: UnlockErrorCode.PASSWORD_WRONG_OR_CHANGED,
            recoveryEnabled,
            bundleExists: bundleStatus?.enabled,
          });
        }
      }
    } catch (err: any) {
      console.error("Unlock error:", err);

      // Use the error message from VaultUnlockError if available
      let errorMessage =
        err.message || "Failed to unlock vault. Please check your password.";
      let showTroubleshooting = false;

      // If it's a VaultUnlockError, use its message directly (and add guidance when appropriate)
      if (err.name === "VaultUnlockError") {
        errorMessage = err.message;

        const errCode = String(err.code || "").toUpperCase();
        if (errCode === "PASSWORD_WRONG_OR_CHANGED") {
          if (looksLikePasswordChangedAfterBundle()) {
            errorMessage =
              "This vault was set up with a different account password. If you recently changed your password (especially via “Forgot password”), the vault key bundle can't be decrypted with the new password.";
          }

          if (recoveryEnabled) {
            errorMessage +=
              " If you changed your password recently, restore using your recovery phrase.";
          } else {
            errorMessage +=
              " If you used “Forgot password” (password reset) and you didn't enable recovery, you'll need a recovery phrase or an existing session where the vault is already unlocked.";
          }
        }
      }

      // Try to provide more specific error messages for non-VaultUnlockError
      if (!err.name || err.name !== "VaultUnlockError") {
        const errorString = String(err).toLowerCase();
        if (errorString.includes("kdfparams") || errorString.includes("salt")) {
          errorMessage =
            "Vault setup data is missing or invalid. Refresh and try again.";
          showTroubleshooting = true;
        } else if (
          errorString.includes("decrypt") ||
          errorString.includes("unwrap")
        ) {
          errorMessage = "Couldn't unlock the vault with that password.";
        } else if (
          errorString.includes("network") ||
          errorString.includes("fetch")
        ) {
          errorMessage =
            "Network error. Please check your connection and try again.";
          showTroubleshooting = true;
        } else if (
          errorString.includes("crypto") ||
          errorString.includes("subtle")
        ) {
          errorMessage =
            "Browser cryptographic error. Try refreshing the page.";
          showTroubleshooting = true;
        }
      }

      // Add troubleshooting guidance for common issues
      if (showTroubleshooting) {
        errorMessage +=
          " If the problem persists, try: 1) Refreshing the page 2) Using a different browser 3) Checking browser developer console for details";
      }

      // Log detailed diagnostic in dev mode
      if (import.meta.env.DEV) {
        console.debug("[VaultUnlock] Detailed error:", {
          name: err.name,
          message: err.message,
          code: err.code,
          stack: err.stack,
          bundleStatus,
          isBootstrapping,
          recoveryEnabled,
          bundleLoaded: bundleStatus?.loaded,
          bundleEnabled: bundleStatus?.enabled,
          hasUser: !!user,
        });

        // Provide actionable debug steps
        console.debug("[VaultUnlock] Troubleshooting steps:");
        console.debug(
          "1. Check browser console for network errors (F12 → Network tab)",
        );
        console.debug("2. Verify API endpoints are accessible");
        console.debug("3. Check if vault bundle exists on server");
        console.debug("4. Clear browser cache and try again");
      }

      setError(errorMessage);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  const handleRestoreWithPhrase = () => {
    setRestoreModalOpen(true);
  };

  const handleRestoreSuccess = async (masterKey: CryptoKey) => {
    setRestoreModalOpen(false);
    setCachedMasterKey(masterKey);

    if (!password.trim()) {
      setError(
        "Enter your account password first. It will be used to re-lock your vault after recovery.",
      );
      return;
    }

    setIsUnlocking(true);
    setError(null);
    try {
      const verify = await authApi.verifyPassword({ password });
      if (!verify.valid) {
        setError(
          "That account password is incorrect. Update it and try recovery again.",
        );
        return;
      }

      const salt = randomBytes(16);
      const passwordKey = await derivePasswordKey(password, salt);
      const bundle = await wrapVaultMasterKeyWithPassword(
        masterKey,
        passwordKey,
        salt,
      );
      await vaultKeyApi.upsert(bundle);

      await loadBundleStatus();
      onUnlockSuccess();
    } catch (e: any) {
      setError(
        e?.message ||
          "Vault was restored, but failed to update the vault key bundle. Please try again.",
      );
    } finally {
      setIsUnlocking(false);
    }
  };

  const canOfferReset = !!bundleStatus?.enabled && recoveryEnabled === false;

  const handleResetVault = async () => {
    if (!user) return;
    if (!password) {
      setError("Enter your account password to reset the vault.");
      return;
    }

    const confirmed = confirm(
      "Reset vault? This deletes your vault key bundle on the server. If you already uploaded encrypted media, it may become permanently unreadable. Continue only if you are sure.",
    );
    if (!confirmed) return;

    setIsResettingVault(true);
    setError(null);
    try {
      await vaultKeyApi.reset({ password });
      await loadBundleStatus();

      const success = await unlockVault(password);
      if (success) {
        setPassword("");
        onUnlockSuccess();
      }
    } catch (e: any) {
      setError(e?.message || "Failed to reset vault.");
    } finally {
      setIsResettingVault(false);
    }
  };

  if (!open) return null;

  if (restoreModalOpen) {
    return (
      <RestoreVaultModal
        open={true}
        onClose={() => setRestoreModalOpen(false)}
        userId={user?.id || ""}
        onRestoreSuccess={handleRestoreSuccess}
        title="Restore Vault with Recovery Phrase"
      />
    );
  }

  const showRecoveryLink =
    showRecoveryOption && recoveryEnabled && !isMasterKeyCached();

  return (
    <Modal
      open={open}
      onClose={() => !isUnlocking && onClose()}
      title={title}
      maxWidth="420px"
      showCloseButton={!isUnlocking}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background:
            "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          margin: "0 auto var(--space-4)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <div
        className="modal-description"
        style={{
          marginBottom: "24px",
          textAlign: "center",
          fontSize: "0.875rem",
          color: "var(--text-secondary)",
        }}
      >
        {message}
      </div>

      {isUnlocking ? (
        <div style={{ textAlign: "center", padding: "var(--space-8)" }}>
          <div
            className="loading-spinner"
            style={{ marginBottom: "var(--space-2)" }}
          />
          <div className="text-secondary">Unlocking vault...</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label
              className="form-label"
              style={{ display: "block", marginBottom: "8px", fontWeight: 500 }}
            >
              {isVaultNotSetUpYet
                ? "Confirm account password"
                : "Account password"}
            </label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder="Password"
              style={{ fontSize: "1rem" }}
            />

            {isVaultNotSetUpYet && (
              <div style={{ marginTop: "12px" }}>
                <label
                  className="form-label"
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: 500,
                  }}
                >
                  Re-enter password
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Re-enter password"
                  style={{ fontSize: "1rem" }}
                />
                <div
                  style={{
                    marginTop: "8px",
                    color: "var(--text-tertiary)",
                    fontSize: "0.75rem",
                    lineHeight: 1.4,
                  }}
                >
                  This prevents a one-time typo from locking you out later.
                </div>
              </div>
            )}

            {!isVaultNotSetUpYet && (
              <div style={{ marginTop: "8px", textAlign: "right" }}>
                <a
                  href="/forgot-password"
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--accent-primary)",
                    textDecoration: "none",
                  }}
                  onClick={() => {
                    // Start password reset flow
                  }}
                >
                  Forgot password?
                </a>
              </div>
            )}
          </div>

          {error && (
            <div
              className="banner banner-danger"
              style={{ padding: "var(--space-3)" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
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
                <span style={{ fontSize: "0.875rem" }}>{error}</span>
              </div>

              {canOfferReset && (
                <div
                  style={{
                    marginTop: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleResetVault}
                    disabled={isUnlocking || isResettingVault}
                    style={{ padding: "8px 10px", fontSize: "0.8rem" }}
                  >
                    {isResettingVault
                      ? "Resetting…"
                      : "Reset vault (destructive)"}
                  </button>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-tertiary)",
                      lineHeight: 1.3,
                      maxWidth: 420,
                    }}
                  >
                    Use only if you haven’t uploaded anything yet, or you accept
                    data loss.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recovery phrase option */}
          {showRecoveryLink && (
            <button
              type="button"
              onClick={handleRestoreWithPhrase}
              className="btn btn-ghost"
              style={{
                width: "100%",
                marginBottom: "var(--space-4)",
                fontSize: "0.875rem",
                color: "var(--accent-secondary)",
              }}
            >
              Locked out? Restore with recovery phrase
            </button>
          )}

          {/* Trust this device option */}
          <div
            style={{
              marginBottom: "var(--space-6)",
              padding: "var(--space-4)",
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              gap: "var(--space-3)",
              alignItems: "flex-start",
            }}
          >
            <input
              type="checkbox"
              id="trustDevice"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              style={{
                width: "16px",
                height: "16px",
                accentColor: "var(--accent-primary)",
                marginTop: "4px",
              }}
            />
            <div style={{ fontSize: "0.875rem" }}>
              <label
                htmlFor="trustDevice"
                style={{
                  fontWeight: 500,
                  display: "block",
                  color: "var(--text-primary)",
                  marginBottom: "4px",
                }}
              >
                Trust this device
              </label>
              <div
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: "0.75rem",
                  lineHeight: "1.4",
                }}
              >
                Trust this device keeps an encrypted vault key in this browser
                so you don’t need to unlock every time. Do not use on shared
                computers.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-3)",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isUnlocking}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isUnlocking}
            >
              {isVaultNotSetUpYet ? "Set up vault" : "Unlock"}
            </button>
          </div>
        </form>
      )}

      <div
        style={{
          marginTop: "var(--space-6)",
          textAlign: "center",
          color: "var(--text-tertiary)",
          fontSize: "0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-2)",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        End-to-End Encrypted. Your password never leaves this device.
      </div>
    </Modal>
  );
};
