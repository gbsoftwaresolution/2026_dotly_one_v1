import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { devicesApi } from "../api/devices";
import { recoveryApi } from "../api/recovery";
import { usersApi } from "../api/users";
import { clearAllKeys } from "../crypto/keyStore";
import { lockVault } from "../crypto/vaultKey";
import { changeVaultPassword } from "../crypto/vaultKey";
import { exportVaultMasterKeyRaw } from "../crypto/vaultKey";
import { importKeyRaw, randomBytes } from "../crypto/webcrypto";
import {
  deriveRecoveryKeyFromSalt,
  wrapVaultMasterKey,
} from "../crypto/recovery";
import { RecoveryPhraseModal } from "../components/RecoveryPhraseModal";
import type { DeviceResponse } from "@booster-vault/shared";
import { useToast } from "../components/ToastProvider";

// --- Icons ---
const UserIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const ShieldIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
);

const LockIcon = () => (
  <svg
    width="20"
    height="20"
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
);

const SmartphoneIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
    <line x1="12" y1="18" x2="12.01" y2="18"></line>
  </svg>
);

const TrashIcon = () => (
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
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const CheckCircleIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    color="var(--accent-primary)"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
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

// --- Components ---

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <div
    style={{
      backgroundColor: "var(--bg-elevated)",
      borderRadius: "16px",
      border: "1px solid var(--border-primary)",
      overflow: "hidden",
      marginBottom: "2rem",
    }}
  >
    <div
      style={{
        padding: "1.25rem 1.5rem",
        borderBottom: "1px solid var(--border-primary)",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ color: "var(--accent-primary)" }}>{icon}</div>
      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{title}</h3>
    </div>
    <div style={{ padding: "1.5rem" }}>{children}</div>
  </div>
);

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Security State
  const [recoveryEnabled, setRecoveryEnabled] = useState(false);
  const [loadingRecovery, setLoadingRecovery] = useState(true);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [isUpdatingRecovery, setIsUpdatingRecovery] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Devices State
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [devicePage, setDevicePage] = useState(1);
  const DEVICES_PER_PAGE = 5;

  // Password Change State
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Deep-link support: /app/settings#danger-zone or /app/settings#clear-keys
  // Scroll within the app's main content container.
  useEffect(() => {
    const hash = (location.hash || "").replace("#", "").trim();
    if (!hash) return;

    const container = document.getElementById("main-content");
    const target = document.getElementById(hash);
    if (!container || !target) return;

    const id = window.setTimeout(() => {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const top =
        container.scrollTop + (targetRect.top - containerRect.top) - 16;
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }, 50);

    return () => window.clearTimeout(id);
  }, [location.hash]);

  const loadInitialData = async () => {
    try {
      const [recStatus, devResponse] = await Promise.all([
        recoveryApi.getStatus(),
        devicesApi.getDevices(),
      ]);
      setRecoveryEnabled(recStatus.enabled);
      setDevices(devResponse.devices);
      setDevicePage(1);
    } catch (e) {
      console.error("Failed to load settings data", e);
    } finally {
      setLoadingRecovery(false);
      setLoadingDevices(false);
    }
  };

  const handleUpdateProfile = async () => {
    setIsSavingProfile(true);
    try {
      await usersApi.updateProfile({ displayName });
      setProfileMessage({
        type: "success",
        text: "Profile updated successfully",
      });
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (err: any) {
      setProfileMessage({
        type: "error",
        text: err.message || "Failed to update profile",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordMessage({ type: "error", text: "New passwords do not match" });
      return;
    }
    setIsChangingPassword(true);
    setPasswordMessage(null);

    try {
      await changeVaultPassword(passwordForm.current, passwordForm.new);
      setPasswordMessage({
        type: "success",
        text: "Password changed successfully",
      });
      setPasswordForm({ current: "", new: "", confirm: "" });
    } catch (err: any) {
      setPasswordMessage({
        type: "error",
        text: err.message || "Failed to change password",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleEnableRecovery = async (phrase: string[]) => {
    if (!user?.id) throw new Error("Not authenticated");
    setIsUpdatingRecovery(true);
    setRecoveryMessage(null);
    try {
      const rawMasterKey = await exportVaultMasterKeyRaw();
      const vaultMasterKey = await importKeyRaw(rawMasterKey);
      const salt = randomBytes(16);
      const recoveryKey = await deriveRecoveryKeyFromSalt(phrase, salt);
      const bundle = await wrapVaultMasterKey(
        vaultMasterKey,
        recoveryKey,
        salt,
      );
      await recoveryApi.enableRecovery(bundle);
      setRecoveryEnabled(true);
      setRecoveryMessage({ type: "success", text: "Recovery phrase enabled" });
      setTimeout(() => setRecoveryMessage(null), 4000);
    } finally {
      setIsUpdatingRecovery(false);
    }
  };

  const handleDisableRecovery = async () => {
    const password = prompt(
      "Enter your password to disable the recovery phrase:",
    );
    if (!password) return;
    setIsUpdatingRecovery(true);
    setRecoveryMessage(null);
    try {
      await recoveryApi.disableRecovery({ password });
      setRecoveryEnabled(false);
      setRecoveryMessage({ type: "success", text: "Recovery phrase disabled" });
      setTimeout(() => setRecoveryMessage(null), 4000);
    } catch (err: any) {
      setRecoveryMessage({
        type: "error",
        text: err.message || "Failed to disable recovery phrase",
      });
    } finally {
      setIsUpdatingRecovery(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm("Are you sure you want to revoke access for this device?"))
      return;
    try {
      await devicesApi.revokeDevice(deviceId);
      setDevices((prev) => {
        const next = prev.filter((d) => d.sessionId !== deviceId);
        const nextMaxPage = Math.max(
          1,
          Math.ceil(next.length / DEVICES_PER_PAGE),
        );
        setDevicePage((p) => Math.min(p, nextMaxPage));
        return next;
      });
    } catch (err: any) {
      toast.danger(
        "Revoke failed",
        err?.message
          ? `Failed to revoke device: ${err.message}`
          : "Failed to revoke device",
      );
    }
  };

  const handleClearKeys = async () => {
    if (
      !confirm(
        "This will delete the encrypted media keys stored in this browser. Existing photos will become unreadable on this device until keys are restored. Continue?",
      )
    )
      return;
    try {
      await clearAllKeys();
      lockVault();
      window.location.reload();
    } catch (err: any) {
      console.error("Error clearing keys:", err);
      toast.danger(
        "Clear keys failed",
        err?.message
          ? `Error clearing keys: ${err.message}`
          : "Error clearing keys",
      );
      // Force reload anyway as fallback
      window.location.reload();
    }
  };

  const handleLockVault = () => {
    try {
      lockVault();
      window.location.reload();
    } catch (err) {
      console.error("Error locking vault:", err);
      window.location.reload();
    }
  };

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <div
      style={{
        paddingBottom: "4rem",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Sticky Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backgroundColor: "rgba(10, 10, 10, 0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border-primary)",
          margin: "-2rem -2rem 2rem -2rem", // Bleed into parent padding (top/left/right)
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
            Settings
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              color: "var(--text-tertiary)",
            }}
          >
            Manage your account and security preferences
          </p>
        </div>
        <button
          onClick={handleLockVault}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1rem",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "var(--danger)",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          <LockIcon />
          Lock Vault
        </button>
      </div>

      <div
        style={{
          paddingTop: "2rem",
          maxWidth: "800px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Account Profile */}
        <Section title="Profile" icon={<UserIcon />}>
          <div style={{ display: "grid", gap: "1.5rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(100px, 1fr) 2fr",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <label
                style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}
              >
                Email
              </label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                  {user?.email}
                </span>
                {user?.emailVerified ? (
                  <span
                    title="Verified"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      color: "var(--accent-primary)",
                      fontSize: "0.8rem",
                      backgroundColor: "rgba(74, 222, 128, 0.1)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    <CheckCircleIcon /> Verified
                  </span>
                ) : (
                  <span
                    style={{
                      color: "#eab308",
                      fontSize: "0.8rem",
                      backgroundColor: "rgba(234, 179, 8, 0.1)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    Unverified
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(100px, 1fr) 2fr",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <label
                style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}
              >
                Display Name
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "0.6rem",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                  }}
                  placeholder="Enter your name"
                />
                <button
                  onClick={handleUpdateProfile}
                  disabled={
                    isSavingProfile || displayName === user?.displayName
                  }
                  style={{
                    padding: "0 1rem",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: isSavingProfile
                      ? "var(--text-tertiary)"
                      : "var(--text-primary)",
                    color: "var(--bg-primary)",
                    fontWeight: 600,
                    cursor: isSavingProfile ? "default" : "pointer",
                  }}
                >
                  {isSavingProfile ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
            {profileMessage && (
              <div
                style={{
                  fontSize: "0.85rem",
                  color:
                    profileMessage.type === "success"
                      ? "var(--accent-primary)"
                      : "var(--danger)",
                  padding: "0.5rem",
                  backgroundColor:
                    profileMessage.type === "success"
                      ? "rgba(74, 222, 128, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                  borderRadius: "6px",
                }}
              >
                {profileMessage.text}
              </div>
            )}
          </div>
        </Section>

        {/* Security */}
        <Section title="Security" icon={<ShieldIcon />}>
          <div style={{ display: "grid", gap: "2rem" }}>
            {/* Recovery */}
            <div>
              <h4
                style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}
              >
                Recovery Phrase
              </h4>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                  backgroundColor: "var(--bg-primary)",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.9rem",
                      }}
                    >
                      Status:
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: loadingRecovery
                          ? "var(--text-tertiary)"
                          : recoveryEnabled
                            ? "var(--accent-primary)"
                            : "var(--danger)",
                      }}
                    >
                      {loadingRecovery
                        ? "Checking..."
                        : recoveryEnabled
                          ? "Enabled & Active"
                          : "Not Configured"}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    Your recovery phrase is the only way to restore access if
                    you forget your password.
                  </span>
                  {recoveryMessage && (
                    <span
                      style={{
                        marginTop: "0.5rem",
                        fontSize: "0.8rem",
                        color:
                          recoveryMessage.type === "success"
                            ? "var(--accent-primary)"
                            : "var(--danger)",
                      }}
                    >
                      {recoveryMessage.text}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (loadingRecovery || isUpdatingRecovery) return;
                    if (recoveryEnabled) {
                      void handleDisableRecovery();
                    } else {
                      setRecoveryModalOpen(true);
                    }
                  }}
                  disabled={loadingRecovery || isUpdatingRecovery}
                  style={{
                    opacity: loadingRecovery || isUpdatingRecovery ? 0.6 : 1,
                    cursor:
                      loadingRecovery || isUpdatingRecovery
                        ? "not-allowed"
                        : "pointer",
                    padding: "0.5rem 1rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border-primary)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                  }}
                >
                  {recoveryEnabled ? "Disable" : "Manage"}
                </button>
              </div>
            </div>

            {/* Change Password */}
            <div>
              <h4
                style={{ margin: "0 0 1rem 0", color: "var(--text-primary)" }}
              >
                Change Password
              </h4>
              <form
                onSubmit={handleChangePassword}
                style={{ display: "grid", gap: "1rem" }}
              >
                <input
                  type="password"
                  placeholder="Current Password"
                  value={passwordForm.current}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      current: e.target.value,
                    }))
                  }
                  style={{
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border-primary)",
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-primary)",
                  }}
                />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1rem",
                  }}
                >
                  <input
                    type="password"
                    placeholder="New Password"
                    value={passwordForm.new}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        new: e.target.value,
                      }))
                    }
                    style={{
                      padding: "0.75rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border-primary)",
                      backgroundColor: "var(--bg-primary)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={passwordForm.confirm}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        confirm: e.target.value,
                      }))
                    }
                    style={{
                      padding: "0.75rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border-primary)",
                      backgroundColor: "var(--bg-primary)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={
                    isChangingPassword ||
                    !passwordForm.current ||
                    !passwordForm.new
                  }
                  style={{
                    justifySelf: "start",
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)",
                    borderRadius: "8px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                  }}
                >
                  {isChangingPassword ? "Updating..." : "Update Password"}
                </button>
              </form>
              {passwordMessage && (
                <div
                  style={{
                    marginTop: "1rem",
                    fontSize: "0.85rem",
                    color:
                      passwordMessage.type === "success"
                        ? "var(--accent-primary)"
                        : "var(--danger)",
                  }}
                >
                  {passwordMessage.text}
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* Devices */}
        <Section title="Active Devices" icon={<SmartphoneIcon />}>
          {loadingDevices ? (
            <div style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>
              Loading devices...
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
              {devices
                .slice(
                  (devicePage - 1) * DEVICES_PER_PAGE,
                  devicePage * DEVICES_PER_PAGE,
                )
                .map((device) => (
                  <div
                    key={device.sessionId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "1rem",
                      backgroundColor: "var(--bg-primary)",
                      borderRadius: "12px",
                      border: device.isCurrent
                        ? "1px solid var(--accent-primary)"
                        : "1px solid transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "1rem",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          backgroundColor: "var(--bg-elevated)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <SmartphoneIcon />
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 500,
                            color: "var(--text-primary)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          {device.deviceName || "Unknown Device"}
                          {device.isCurrent && (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                backgroundColor: "var(--accent-primary)",
                                color: "#000",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                fontWeight: 700,
                              }}
                            >
                              YOU
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          Last active: {formatDate(device.lastSeenAt)}
                        </div>
                      </div>
                    </div>
                    {!device.isCurrent && (
                      <button
                        onClick={() => handleRevokeDevice(device.sessionId)}
                        style={{
                          color: "var(--danger)",
                          padding: "0.5rem",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                        }}
                        title="Revoke Access"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                ))}
              {devices.length > DEVICES_PER_PAGE && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "0.5rem",
                    marginTop: "1rem",
                  }}
                >
                  <button
                    disabled={devicePage === 1}
                    onClick={() => setDevicePage((p) => p - 1)}
                    style={{
                      padding: "0.5rem 1rem",
                      border: "1px solid var(--border-primary)",
                      borderRadius: "8px",
                      background: "var(--bg-primary)",
                      color:
                        devicePage === 1
                          ? "var(--text-tertiary)"
                          : "var(--text-primary)",
                      cursor: devicePage === 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    Previous
                  </button>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      color: "var(--text-secondary)",
                      fontSize: "0.9rem",
                    }}
                  >
                    Page {devicePage} of{" "}
                    {Math.ceil(devices.length / DEVICES_PER_PAGE)}
                  </span>
                  <button
                    disabled={
                      devicePage >= Math.ceil(devices.length / DEVICES_PER_PAGE)
                    }
                    onClick={() => setDevicePage((p) => p + 1)}
                    style={{
                      padding: "0.5rem 1rem",
                      border: "1px solid var(--border-primary)",
                      borderRadius: "8px",
                      background: "var(--bg-primary)",
                      color:
                        devicePage >=
                        Math.ceil(devices.length / DEVICES_PER_PAGE)
                          ? "var(--text-tertiary)"
                          : "var(--text-primary)",
                      cursor:
                        devicePage >=
                        Math.ceil(devices.length / DEVICES_PER_PAGE)
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Danger Zone */}
        <div
          id="danger-zone"
          style={{
            borderRadius: "16px",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            backgroundColor: "rgba(239, 68, 68, 0.05)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid rgba(239, 68, 68, 0.2)",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <div style={{ color: "var(--danger)" }}>
              <AlertIcon />
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--danger)",
              }}
            >
              Danger Zone
            </h3>
          </div>
          <div
            id="clear-keys"
            style={{
              padding: "1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h4
                style={{
                  margin: "0 0 0.25rem 0",
                  color: "var(--text-primary)",
                }}
              >
                Clear Local Keys
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                }}
              >
                Removes all encryption keys from this browser. You'll need to
                log in again.
              </p>
            </div>
            <button
              onClick={handleClearKeys}
              style={{
                padding: "0.6rem 1rem",
                backgroundColor: "var(--danger)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Clear Keys
            </button>
          </div>
        </div>

        <RecoveryPhraseModal
          open={recoveryModalOpen}
          onClose={() => setRecoveryModalOpen(false)}
          onComplete={async (phrase) => {
            await handleEnableRecovery(phrase);
            setRecoveryModalOpen(false);
          }}
        />
      </div>
    </div>
  );
};
