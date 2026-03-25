import React, { useState } from "react";
import { Loading } from "./Loading";
import { authApi } from "../api/auth";
import { changeVaultPassword } from "../crypto/vaultKey";

interface ChangePasswordFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateForm = (): boolean => {
    if (!currentPassword.trim()) {
      setError("Current password is required");
      return false;
    }
    if (!newPassword.trim()) {
      setError("New password is required");
      return false;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return false;
    }
    if (currentPassword === newPassword) {
      setError("New password must be different from current password");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: Change vault master key encryption (client-side)
      const vaultPasswordChanged = await changeVaultPassword(
        currentPassword,
        newPassword,
      );
      if (!vaultPasswordChanged) {
        throw new Error("Current vault password is incorrect");
      }

      // Step 2: Change account password (server-side)
      await authApi.changePassword({
        currentPassword,
        newPassword,
      });

      // Success
      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 2000);
    } catch (err: any) {
      console.error("Failed to change password:", err);
      setError(err.message || "Failed to change password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div
        style={{
          backgroundColor: "#d4edda",
          border: "1px solid #c3e6cb",
          borderRadius: "4px",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h3 style={{ color: "#155724", marginTop: 0 }}>
          Password Changed Successfully
        </h3>
        <p style={{ color: "#155724", marginBottom: "1.5rem" }}>
          Your password has been updated. You will be redirected shortly.
        </p>
        <div style={{ color: "#155724", fontSize: "0.875rem" }}>
          <p>
            <strong>Important:</strong> Your encryption keys have been rewrapped
            with the new password.
          </p>
          <p>All existing media remains accessible.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: "8px",
        border: "1px solid #eaeaea",
        padding: "1.5rem",
        maxWidth: "500px",
        margin: "0 auto",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Change Password</h3>

      <div
        style={{
          backgroundColor: "#fff3cd",
          border: "1px solid #ffecb5",
          borderRadius: "4px",
          padding: "0.75rem",
          color: "#856404",
          fontSize: "0.875rem",
          marginBottom: "1.5rem",
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>How password change works:</strong>
        </p>
        <ul style={{ margin: "0.5rem 0", paddingLeft: "1.25rem" }}>
          <li>Your vault master key stays the same</li>
          <li>Only the encryption of that key changes</li>
          <li>All existing media remains accessible</li>
          <li>You will be logged out from all other devices</li>
        </ul>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: "#f8d7da",
            border: "1px solid #f5c6cb",
            borderRadius: "4px",
            padding: "0.75rem",
            marginBottom: "1rem",
            color: "#721c24",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      {isSubmitting ? (
        <div style={{ textAlign: "center" }}>
          <Loading message="Changing password..." />
          <p
            style={{
              fontSize: "0.875rem",
              color: "#6c757d",
              marginTop: "1rem",
            }}
          >
            This may take a moment. Please don't close this window.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "500",
              }}
            >
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoFocus
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #dee2e6",
                borderRadius: "4px",
                fontSize: "1rem",
              }}
              placeholder="Enter your current password"
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "500",
              }}
            >
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #dee2e6",
                borderRadius: "4px",
                fontSize: "1rem",
              }}
              placeholder="Enter new password (min. 8 characters)"
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "500",
              }}
            >
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #dee2e6",
                borderRadius: "4px",
                fontSize: "1rem",
              }}
              placeholder="Confirm new password"
            />
          </div>

          <div
            style={{
              backgroundColor: "#e7f1ff",
              border: "1px solid #cfe2ff",
              borderRadius: "4px",
              padding: "0.75rem",
              color: "#084298",
              fontSize: "0.875rem",
              marginBottom: "1.5rem",
            }}
          >
            <p style={{ margin: 0 }}>
              <strong
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
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
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Security Note:
              </strong>{" "}
              Changing your password will log you out from all other devices.
              Your vault master key remains the same, so all your existing
              encrypted media stays accessible.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
            }}
          >
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: "0.5rem 1.5rem",
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #dee2e6",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "0.5rem 1.5rem",
                backgroundColor: "#007bff",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              Change Password
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
