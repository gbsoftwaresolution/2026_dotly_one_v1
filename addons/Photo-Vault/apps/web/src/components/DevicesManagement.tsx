import React, { useState, useEffect } from "react";
import { devicesApi } from "../api/devices";
import type { DeviceResponse } from "@booster-vault/shared";
import { Loading } from "./Loading";
import { useAuth } from "../app/AuthProvider";

export const DevicesManagement: React.FC = () => {
  const { logout } = useAuth();
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  // Client-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const response = await devicesApi.getDevices();
      setDevices(response.devices);
      // Reset to page 1 on refresh if current page is empty
      if (Math.ceil(response.devices.length / PAGE_SIZE) < currentPage) {
        setCurrentPage(1);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const handleRenameStart = (device: DeviceResponse) => {
    setRenamingId(device.sessionId);
    setNewName(device.deviceName || "");
  };

  const handleRenameCancel = () => {
    setRenamingId(null);
    setNewName("");
  };

  const handleRenameSubmit = async (sessionId: string) => {
    if (!newName.trim()) return;

    try {
      await devicesApi.renameDevice(sessionId, newName);
      await loadDevices();
      setRenamingId(null);
      setNewName("");
    } catch (err: any) {
      setError(err.message || "Failed to rename device");
    }
  };

  const handleRevokeDevice = async (sessionId: string, isCurrent: boolean) => {
    if (
      !confirm(
        `Are you sure you want to revoke this device? ${isCurrent ? "This will log you out immediately." : ""}`,
      )
    ) {
      return;
    }

    try {
      setRevokingId(sessionId);
      await devicesApi.revokeDevice(sessionId);

      if (isCurrent) {
        // Current session was revoked, logout immediately
        logout();
        return;
      }

      await loadDevices();
    } catch (err: any) {
      setError(err.message || "Failed to revoke device");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOtherDevices = async () => {
    if (
      !confirm(
        "Are you sure you want to sign out of all other devices? This will keep only this browser session active.",
      )
    ) {
      return;
    }

    try {
      setRevokingOthers(true);
      await devicesApi.revokeOtherDevices();
      await loadDevices();
    } catch (err: any) {
      setError(err.message || "Failed to revoke other devices");
    } finally {
      setRevokingOthers(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDeviceIcon = (deviceType?: string) => {
    const type = deviceType?.toLowerCase() || "";
    if (
      type.includes("mobile") ||
      type.includes("android") ||
      type.includes("iphone")
    ) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
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
    } else if (type.includes("tablet") || type.includes("ipad")) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
          <line x1="12" y1="18" x2="12.01" y2="18"></line>
        </svg>
      );
    } else if (type.includes("desktop")) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      );
    } else {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      );
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <Loading message="Loading devices..." />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ margin: 0 }}>Devices</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={handleRevokeOtherDevices}
            disabled={
              revokingOthers || devices.filter((d) => !d.isCurrent).length === 0
            }
            style={{
              padding: "0.5rem 1rem",
              backgroundColor:
                revokingOthers ||
                devices.filter((d) => !d.isCurrent).length === 0
                  ? "#6c757d"
                  : "#dc3545",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor:
                revokingOthers ||
                devices.filter((d) => !d.isCurrent).length === 0
                  ? "not-allowed"
                  : "pointer",
              fontWeight: "500",
              fontSize: "0.875rem",
            }}
          >
            {revokingOthers ? "Signing out..." : "Sign out of other devices"}
          </button>
          <button
            onClick={loadDevices}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#6c757d",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "500",
              fontSize: "0.875rem",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "0.75rem",
            backgroundColor: "#f8d7da",
            border: "1px solid #f5c6cb",
            borderRadius: "4px",
            color: "#721c24",
            marginBottom: "1rem",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          backgroundColor: "#fff",
          border: "1px solid #eaeaea",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {devices.length === 0 ? (
          <div
            style={{ padding: "2rem", textAlign: "center", color: "#6c757d" }}
          >
            No active devices found.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead
                style={{
                  backgroundColor: "#f8f9fa",
                  borderBottom: "1px solid #eaeaea",
                }}
              >
                <tr>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      fontSize: "0.875rem",
                      fontWeight: "600",
                    }}
                  >
                    Device
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      fontSize: "0.875rem",
                      fontWeight: "600",
                    }}
                  >
                    Browser / OS
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      fontSize: "0.875rem",
                      fontWeight: "600",
                    }}
                  >
                    Last Active
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      fontSize: "0.875rem",
                      fontWeight: "600",
                    }}
                  >
                    Created
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      fontSize: "0.875rem",
                      fontWeight: "600",
                    }}
                  >
                    IP Address
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      fontSize: "0.875rem",
                      fontWeight: "600",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr
                    key={device.sessionId}
                    style={{
                      borderBottom: "1px solid #f8f9fa",
                      backgroundColor: device.isCurrent
                        ? "#f0f9ff"
                        : "transparent",
                    }}
                  >
                    <td style={{ padding: "1rem", fontSize: "0.875rem" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span style={{ fontSize: "1.25rem" }}>
                          {getDeviceIcon(device.deviceType)}
                        </span>
                        <div>
                          <div style={{ fontWeight: "500" }}>
                            {renamingId === device.sessionId ? (
                              <div style={{ display: "flex", gap: "0.25rem" }}>
                                <input
                                  type="text"
                                  value={newName}
                                  onChange={(e) => setNewName(e.target.value)}
                                  style={{
                                    padding: "0.25rem 0.5rem",
                                    border: "1px solid #dee2e6",
                                    borderRadius: "4px",
                                    fontSize: "0.875rem",
                                    width: "150px",
                                  }}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      handleRenameSubmit(device.sessionId);
                                    if (e.key === "Escape")
                                      handleRenameCancel();
                                  }}
                                />
                                <button
                                  onClick={() =>
                                    handleRenameSubmit(device.sessionId)
                                  }
                                  style={{
                                    padding: "0.25rem 0.5rem",
                                    backgroundColor: "#28a745",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "4px",
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleRenameCancel}
                                  style={{
                                    padding: "0.25rem 0.5rem",
                                    backgroundColor: "#6c757d",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "4px",
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                {device.deviceName}
                                {device.isCurrent && (
                                  <span
                                    style={{
                                      marginLeft: "0.5rem",
                                      padding: "0.125rem 0.375rem",
                                      backgroundColor: "#007bff",
                                      color: "#fff",
                                      borderRadius: "12px",
                                      fontSize: "0.75rem",
                                      fontWeight: "400",
                                    }}
                                  >
                                    Current
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <div
                            style={{ fontSize: "0.75rem", color: "#6c757d" }}
                          >
                            {device.deviceType || "Unknown device"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.875rem" }}>
                      <div>
                        <div>{device.browser || "Unknown browser"}</div>
                        <div style={{ fontSize: "0.75rem", color: "#6c757d" }}>
                          {device.os || "Unknown OS"}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.875rem" }}>
                      {formatDate(device.lastSeenAt)}
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.875rem" }}>
                      {formatDate(device.createdAt)}
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.875rem" }}>
                      {device.ipAddress || "—"}
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.875rem" }}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {renamingId !== device.sessionId && (
                          <button
                            onClick={() => handleRenameStart(device)}
                            disabled={!!renamingId}
                            style={{
                              padding: "0.25rem 0.5rem",
                              backgroundColor: "#6c757d",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              cursor: renamingId ? "not-allowed" : "pointer",
                            }}
                          >
                            Rename
                          </button>
                        )}
                        <button
                          onClick={() =>
                            handleRevokeDevice(
                              device.sessionId,
                              device.isCurrent,
                            )
                          }
                          disabled={
                            revokingId === device.sessionId || !!renamingId
                          }
                          style={{
                            padding: "0.25rem 0.5rem",
                            backgroundColor: device.isCurrent
                              ? "#dc3545"
                              : "#6c757d",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            cursor:
                              revokingId === device.sessionId || renamingId
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {revokingId === device.sessionId
                            ? "Revoking..."
                            : device.isCurrent
                              ? "Log out"
                              : "Revoke"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        style={{
          backgroundColor: "#fff3cd",
          border: "1px solid #ffecb5",
          borderRadius: "4px",
          padding: "0.75rem",
          color: "#856404",
          fontSize: "0.875rem",
          marginTop: "1.5rem",
        }}
      >
        <p style={{ margin: 0 }}>
          <strong
            style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
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
          Devices represent active sessions where you're logged in. If you see
          an unfamiliar device, revoke it immediately. Revoking a device logs it
          out immediately.
        </p>
      </div>
    </div>
  );
};
