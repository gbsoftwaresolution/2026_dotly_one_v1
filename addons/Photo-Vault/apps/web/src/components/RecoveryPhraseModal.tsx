import React, { useState, useEffect } from "react";
import { Modal } from "./Modal";
import {
  generateRecoveryPhrase,
  generateConfirmationIndices,
  confirmRecoveryPhrase,
} from "../crypto/recovery";

interface RecoveryPhraseModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (phrase: string[]) => Promise<void>;
  title?: string;
}

export const RecoveryPhraseModal: React.FC<RecoveryPhraseModalProps> = ({
  open,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<"warning" | "show" | "confirm" | "success">(
    "warning",
  );
  const [phrase, setPhrase] = useState<string[]>([]);
  const [confirmIndices, setConfirmIndices] = useState<number[]>([]);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && phrase.length === 0) {
      const p = generateRecoveryPhrase();
      setPhrase(p);
      setConfirmIndices(generateConfirmationIndices());
      setStep("warning");
      setAccepted(false);
      setInputs({});
      setError(null);
    }
  }, [open, phrase.length]);

  const handleCopy = () => {
    navigator.clipboard.writeText(phrase.join(" "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = async () => {
    setError(null);
    const userWords = confirmIndices.map(
      (idx) => inputs[idx]?.trim().toLowerCase() || "",
    );
    if (!confirmRecoveryPhrase(phrase, userWords, confirmIndices)) {
      setError("Incorrect words. Please check your backup and try again.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onComplete(phrase);
      setStep("success");
    } catch (err: any) {
      setError(err.message || "Failed to enable recovery");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={() => !isSubmitting && step !== "success" && onClose()}
      title="Recovery Setup"
      maxWidth="500px"
      showCloseButton={!isSubmitting && step !== "success"}
    >
      <div style={{ padding: "0 0" }}>
        {step === "warning" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: "var(--space-4)", color: "#eab308" }}>
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
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3 style={{ margin: "0 0 var(--space-4)", fontSize: "1.25rem" }}>
              Secure Your Vault
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                marginBottom: "var(--space-6)",
              }}
            >
              We are about to generate a 12-word recovery phrase. This phrase is
              the <strong>only way</strong> to restore access if you forget your
              password. We do not store a copy.
            </p>
            <label
              style={{
                display: "flex",
                gap: "var(--space-3)",
                alignItems: "flex-start",
                textAlign: "left",
                padding: "var(--space-3)",
                background: "rgba(234, 179, 8, 0.1)",
                border: "1px solid rgba(234, 179, 8, 0.2)",
                borderRadius: "var(--radius-lg)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                style={{
                  marginTop: "0.25rem",
                  accentColor: "var(--accent-primary)",
                }}
              />
              <span style={{ fontSize: "0.9rem", color: "#fbbf24" }}>
                I understand that if I lose this phrase, I will lose access to
                my encrypted data forever.
              </span>
            </label>
            <button
              disabled={!accepted}
              onClick={() => setStep("show")}
              className="btn btn-primary"
              style={{
                marginTop: "var(--space-6)",
                width: "100%",
                padding: "12px",
              }}
            >
              Reveal Phrase
            </button>
          </div>
        )}

        {step === "show" && (
          <div>
            <p
              style={{
                textAlign: "center",
                color: "var(--text-secondary)",
                marginBottom: "var(--space-5)",
              }}
            >
              Write these words down in order and store them somewhere safe.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "var(--space-2)",
                marginBottom: "var(--space-6)",
              }}
            >
              {phrase.map((word, i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--bg-primary)",
                    padding: "8px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                  }}
                >
                  <span
                    style={{
                      color: "var(--text-tertiary)",
                      fontSize: "0.8rem",
                      width: "16px",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>
                    {word}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button
                onClick={handleCopy}
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
              <button
                onClick={() => setStep("confirm")}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                I've Saved It
              </button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div>
            <h3
              style={{
                textAlign: "center",
                marginBottom: "var(--space-2)",
                fontSize: "1.1rem",
              }}
            >
              Verify Backup
            </h3>
            <p
              style={{
                textAlign: "center",
                color: "var(--text-secondary)",
                marginBottom: "var(--space-6)",
              }}
            >
              Select the correct words to confirm you saved them.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
                marginBottom: "var(--space-6)",
              }}
            >
              {confirmIndices.map((idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "0.9rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Word #{idx + 1}
                  </label>
                  <input
                    type="text"
                    value={inputs[idx] || ""}
                    onChange={(e) =>
                      setInputs((prev) => ({ ...prev, [idx]: e.target.value }))
                    }
                    placeholder={`Enter word #${idx + 1}`}
                    className="form-input"
                    autoCapitalize="off"
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>
            {error && (
              <div
                className="banner banner-danger"
                style={{
                  marginBottom: "var(--space-4)",
                  padding: "var(--space-3)",
                }}
              >
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button
                onClick={() => setStep("show")}
                className="btn btn-secondary"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {isSubmitting ? "Verifying..." : "Confirm"}
              </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div style={{ textAlign: "center", padding: "var(--space-4) 0" }}>
            <div
              style={{
                marginBottom: "var(--space-4)",
                color: "var(--success)",
                lineHeight: 1,
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
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 style={{ fontSize: "1.5rem", marginBottom: "var(--space-4)" }}>
              All Set!
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                marginBottom: "var(--space-6)",
              }}
            >
              Your recovery phrase is active. Keep it safe!
            </p>
            <button
              onClick={onClose}
              className="btn btn-primary"
              style={{ width: "100%" }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
