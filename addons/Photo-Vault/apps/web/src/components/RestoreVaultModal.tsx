import React, { useState } from "react";
import { Modal } from "./Modal";
import {
  deriveRecoveryKeyFromKdfParams,
  unwrapVaultMasterKey,
  validateRecoveryPhraseFormat,
} from "../crypto/recovery";
import { clearMasterKeyCache } from "../crypto/vaultKey";
import { recoveryApi } from "../api/recovery";

interface RestoreVaultModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onRestoreSuccess: (masterKey: CryptoKey) => void; // Called when recovery phrase successfully decrypts master key
  title?: string;
}

export const RestoreVaultModal: React.FC<RestoreVaultModalProps> = ({
  open,
  onClose,
  userId,
  onRestoreSuccess,
  title = "Restore Vault with Recovery Phrase",
}) => {
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"input" | "success">("input");
  const [attemptCount, setAttemptCount] = useState(0);
  const [delayTimer, setDelayTimer] = useState<NodeJS.Timeout | null>(null);

  // Rate limiting: add delay after failed attempts
  const getDelayMs = () => {
    if (attemptCount >= 5) return 30000; // 30 seconds
    if (attemptCount >= 3) return 10000; // 10 seconds
    if (attemptCount >= 1) return 2000; // 2 seconds
    return 0;
  };

  const clearTimer = () => {
    if (delayTimer) {
      clearTimeout(delayTimer);
      setDelayTimer(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const delay = getDelayMs();
    if (delay > 0) {
      setError(`Please wait ${delay / 1000} seconds before trying again`);
      return;
    }

    if (!recoveryPhrase.trim()) {
      setError("Recovery phrase is required");
      return;
    }

    // Parse phrase (space or comma separated)
    const phraseArray = recoveryPhrase
      .trim()
      .split(/[\s,]+/)
      .map((word) => word.trim().toLowerCase())
      .filter((word) => word.length > 0);

    // Basic validation
    if (!validateRecoveryPhraseFormat(phraseArray)) {
      setError(
        "Invalid recovery phrase format. Must be 12 words from the standard word list.",
      );
      return;
    }

    setIsRestoring(true);
    setError(null);

    try {
      // Fetch encrypted bundle from server
      const bundle = await recoveryApi.getRecoveryBundle(userId);

      // Derive recovery key from phrase
      const recoveryKey = await deriveRecoveryKeyFromKdfParams(
        phraseArray,
        bundle.kdfParams,
        userId,
      );

      // Unwrap (decrypt) vault master key
      const masterKey = await unwrapVaultMasterKey(
        bundle.encryptedMasterKey,
        bundle.iv,
        recoveryKey,
      );

      // Set as cached master key
      clearMasterKeyCache();
      // Store the master key in cache (in memory)
      // Note: We don't have a setter for masterKeyCache, but we can call onRestoreSuccess
      // The parent component should handle setting the master key
      onRestoreSuccess(masterKey);

      setStep("success");
      setAttemptCount(0);
      clearTimer();
    } catch (err: any) {
      console.error("Restore failed:", err);

      // Increment attempt count
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);

      // Set error message
      let errorMsg = err.message || "Failed to restore vault";

      // Add delay hint for subsequent attempts
      const nextDelay = getDelayMs();
      if (nextDelay > 0) {
        errorMsg += `. Next attempt available in ${nextDelay / 1000} seconds.`;

        // Auto-clear delay after timeout
        const timer = setTimeout(() => {
          setError(null);
          setDelayTimer(null);
        }, nextDelay);
        setDelayTimer(timer);
      }

      setError(errorMsg);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
    if (e.key === "Enter" && !isRestoring && step === "input") {
      handleSubmit(e);
    }
  };

  if (!open) return null;

  if (step === "success") {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Vault Restored!"
        maxWidth="480px"
      >
        <div style={{ textAlign: "center", padding: "var(--space-6) 0" }}>
          <div
            style={{
              fontSize: "3rem",
              marginBottom: "var(--space-4)",
              color: "var(--success)",
              lineHeight: 1,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <p
            style={{
              color: "var(--text-secondary)",
              marginBottom: "var(--space-6)",
              lineHeight: 1.6,
            }}
          >
            Your vault master key has been successfully recovered. You can now
            access your encrypted files.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            Continue to Vault
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={() => !isRestoring && onClose()}
      title={title}
      maxWidth="520px"
      showCloseButton={!isRestoring}
    >
      <p
        style={{
          color: "var(--text-secondary)",
          marginBottom: "var(--space-6)",
          marginTop: "-8px",
        }}
      >
        Enter your 12-word recovery phrase to restore access to your vault on
        this device.
      </p>

      {isRestoring ? (
        <div style={{ textAlign: "center", padding: "var(--space-8)" }}>
          <div
            className="loading-spinner"
            style={{ margin: "0 auto var(--space-4) auto" }}
          />
          <p className="text-secondary">Restoring vault...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "var(--space-5)" }}>
            <label
              style={{
                display: "block",
                marginBottom: "var(--space-2)",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              Recovery Phrase (12 words)
            </label>
            <textarea
              value={recoveryPhrase}
              onChange={(e) => setRecoveryPhrase(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={4}
              placeholder="Enter your 12-word recovery phrase, separated by spaces or commas"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-primary)",
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                fontSize: "0.95rem",
                fontFamily: "monospace",
                resize: "vertical",
                minHeight: "100px",
              }}
            />
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-tertiary)",
                marginTop: "var(--space-2)",
              }}
            >
              Words are case-insensitive. Separate with spaces or commas.
            </div>
          </div>

          {error && (
            <div
              className="banner banner-danger"
              style={{
                marginBottom: "var(--space-4)",
                padding: "var(--space-3)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  alignItems: "center",
                }}
              >
                <svg
                  style={{ flexShrink: 0 }}
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
                <span>{error}</span>
              </div>
            </div>
          )}

          <div
            className="banner banner-warning"
            style={{
              marginBottom: "var(--space-6)",
              padding: "var(--space-4)",
            }}
          >
            <p
              style={{
                margin: "0 0 var(--space-2) 0",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "8px",
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
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Security Notice
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: "var(--space-4)",
                fontSize: "0.85rem",
              }}
            >
              <li>Your recovery phrase is never sent to our servers</li>
              <li>Decryption happens entirely in your browser</li>
              <li>Failed attempts are rate-limited for security</li>
            </ul>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-3)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isRestoring}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRestoring}
              className="btn btn-primary"
            >
              Restore Vault
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
