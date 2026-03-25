import React from "react";
import { Modal } from "./Modal";

interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  isLoading = false,
}) => {
  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={() => !isLoading && onClose()}
      title={title}
      maxWidth="400px"
      showCloseButton={!isLoading}
    >
      <div
        style={{
          fontSize: "0.95rem",
          color: "var(--text-secondary)",
          lineHeight: "1.5",
          textAlign: "center",
          marginBottom: "24px",
          marginTop: "-8px",
        }}
      >
        {message}
      </div>

      <div style={{ display: "flex", gap: "12px" }}>
        <button
          onClick={onClose}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "10px 16px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-primary)",
            backgroundColor: "transparent",
            color: "var(--text-primary)",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            opacity: isLoading ? 0.7 : 1,
          }}
          onMouseOver={(e) => {
            if (!isLoading)
              e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
          }}
          onMouseOut={(e) => {
            if (!isLoading)
              e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "10px 16px",
            borderRadius: "var(--radius-md)",
            border: "none",
            backgroundColor: isDestructive
              ? "var(--danger)"
              : "var(--accent-primary)",
            color: "#fff",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            boxShadow: isDestructive
              ? "0 4px 12px rgba(239, 68, 68, 0.3)"
              : "0 4px 12px rgba(var(--accent-primary-rgb), 0.3)",
            transition: "all 0.2s ease",
            opacity: isLoading ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
          onMouseOver={(e) => {
            if (!isLoading)
              e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseOut={(e) => {
            if (!isLoading) e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          {isLoading ? (
            <>
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Processing...
            </>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </Modal>
  );
};
