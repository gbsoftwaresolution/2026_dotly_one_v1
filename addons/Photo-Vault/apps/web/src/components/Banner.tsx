import type { ReactNode } from "react";
import React from "react";
import { Link } from "react-router-dom";

export interface BannerProps {
  type: "info" | "success" | "warning" | "danger";
  title: string;
  message: ReactNode;
  action?: {
    label: string;
    onClick?: () => void;
    to?: string;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    to?: string;
    disabled?: boolean;
  };
  onDismiss?: () => void;
}

const Icons = {
  info: () => (
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
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  ),
  success: () => (
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
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  ),
  warning: () => (
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
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  ),
  danger: () => (
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
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
  ),
};

export const Banner: React.FC<BannerProps> = ({
  type,
  title,
  message,
  action,
  secondaryAction,
  onDismiss,
}) => {
  const Icon = Icons[type];

  const renderActionButton = (
    actionItem: BannerProps["action"],
    key: string,
  ) => {
    if (!actionItem) return null;

    // Using inline styles to ensure immediate visual consistency without overly complex CSS classes
    // But ideally these should be utility classes
    const isPrimary = key === "primary";
    const baseStyle = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "0.8125rem",
      fontWeight: 600,
      borderRadius: "var(--radius-md)",
      padding: "0.375rem 0.75rem",
      transition: "all 0.2s",
      cursor: actionItem.disabled ? "not-allowed" : "pointer",
      opacity: actionItem.disabled ? 0.6 : 1,
      border: isPrimary ? "none" : "1px solid currentColor",
      backgroundColor: isPrimary ? "currentColor" : "transparent",
      color: isPrimary ? "var(--bg-primary)" : "currentColor",
      textDecoration: "none",
    };

    if (actionItem.to) {
      return (
        <Link
          to={actionItem.to}
          style={baseStyle}
          className={isPrimary ? "primary-action" : ""}
        >
          {actionItem.label}
        </Link>
      );
    }

    return (
      <button
        style={baseStyle}
        onClick={actionItem.onClick}
        disabled={actionItem.disabled}
      >
        {actionItem.label}
      </button>
    );
  };

  return (
    <div className={`banner banner-${type}`}>
      <div style={{ flexShrink: 0, marginTop: "2px" }}>
        <Icon />
      </div>
      <div className="banner-content">
        <div className="banner-title">{title}</div>
        <div className="banner-message">{message}</div>
        {(action || secondaryAction) && (
          <div
            style={{
              marginTop: "0.75rem",
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            {action && renderActionButton(action, "primary")}
            {secondaryAction &&
              renderActionButton(secondaryAction, "secondary")}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            color: "currentColor",
            opacity: 0.5,
            cursor: "pointer",
            padding: "4px",
            borderRadius: "4px",
            marginLeft: "8px",
            display: "flex",
          }}
          aria-label="Dismiss"
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
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
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}
    </div>
  );
};
