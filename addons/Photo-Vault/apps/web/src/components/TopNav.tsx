import React from "react";
import { Link } from "react-router-dom";
import type { User } from "../types/user";
import { useAuth } from "../app/AuthProvider";
import { ShieldIcon } from "./icons/ShieldIcon";

interface TopNavProps {
  user: User | null;
}

export const TopNav: React.FC<TopNavProps> = ({ user }) => {
  const { logout } = useAuth();

  const getInitials = (user: User) => {
    if (user.displayName) {
      return user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }
    return user.email?.slice(0, 2).toUpperCase() || "??";
  };

  return (
    <header
      className="top-nav"
      style={{
        background: "rgba(18, 18, 18, 0.8)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}
      >
        <Link
          to="/app/vault/library"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              color: "var(--accent-primary)",
              filter: "drop-shadow(0 0 8px rgba(0, 212, 255, 0.3))",
            }}
          >
            <ShieldIcon size={28} />
          </div>
          <span
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              letterSpacing: "-.02em",
              background: "linear-gradient(135deg, #fff 30%, #94a3b8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              display: "block",
            }}
          >
            BoosterAi.me
          </span>
        </Link>

        {user && !user.emailVerified && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.15)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              color: "#fbbf24",
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "0.8rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginLeft: "12px",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
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
            <span>Verify Email</span>
          </div>
        )}
      </div>

      <div
        style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}
      >
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* User Profile Pill */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "rgba(255, 255, 255, 0.05)",
                padding: "6px 8px 6px 16px",
                borderRadius: "30px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  lineHeight: 1.2,
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    fontSize: "0.9rem",
                  }}
                >
                  {user.displayName || user.email}
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--accent-primary)",
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                  }}
                >
                  {user.subscriptionStatus === "TRIAL"
                    ? "FREE TRIAL"
                    : (user.currentPlanCode || "ACTIVE").toUpperCase()}
                </span>
              </div>

              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  color: "#fff",
                  fontSize: "0.9rem",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
                }}
              >
                {getInitials(user)}
              </div>
            </div>

            <button
              onClick={logout}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-tertiary)",
                padding: "8px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--text-primary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-tertiary)")
              }
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
