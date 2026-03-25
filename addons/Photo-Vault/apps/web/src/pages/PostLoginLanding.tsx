import React, { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LockIcon,
  CreditCardIcon,
  UsersIcon,
  GlobeIcon,
} from "../components/icons";

// Fallback for missing icon if needed
const DocIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    width={24}
    height={24}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const TimelineIconStub = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    width={24}
    height={24}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

type LocationState = {
  next?: string;
};

function isSafeInternalPath(path: unknown): path is string {
  if (typeof path !== "string") return false;
  if (!path.startsWith("/")) return false;
  // Prevent protocol-relative URLs (open redirect).
  if (path.startsWith("//")) return false;
  return true;
}

const AppCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  gradient: string;
  badge?: string;
  primaryActionLabel: string;
  secondaryActions?: { label: string; to: string }[];
}> = ({
  title,
  description,
  icon,
  to,
  gradient,
  badge,
  primaryActionLabel,
  secondaryActions,
}) => {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: "24px",
        overflow: "hidden",
        border: "1px solid var(--border-primary)",
        background: "var(--bg-elevated)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
      className="dashboard-card"
    >
      {/* Header / Brand Area */}
      <div
        style={{
          background: gradient,
          padding: "var(--space-6)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.2)",
            borderRadius: "16px",
            padding: "12px",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          {React.cloneElement(icon as React.ReactElement, {
            size: 32,
            width: 32,
            height: 32,
          })}
        </div>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "white",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {title}
            {badge && (
              <span
                style={{
                  fontSize: "0.75rem",
                  background: "white",
                  color: "black",
                  padding: "2px 8px",
                  borderRadius: "99px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {badge}
              </span>
            )}
          </h3>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          padding: "var(--space-6)",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: "var(--space-6)",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            fontSize: "1rem",
          }}
        >
          {description}
        </p>

        <div
          style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}
        >
          <Link
            to={to}
            className="btn btn-secondary"
            style={{
              flex: 1,
              justifyContent: "center",
              fontWeight: 600,
              border: "1px solid var(--border)",
            }}
          >
            {primaryActionLabel}
          </Link>
          {secondaryActions?.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="btn btn-ghost"
              style={{ padding: "8px 12px" }}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

const QuickLink: React.FC<{
  icon: React.ReactNode;
  label: string;
  to: string;
}> = ({ icon, label, to }) => (
  <Link
    to={to}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "16px",
      borderRadius: "16px",
      background: "var(--bg-elevated)", // Darker/Lighter card bg
      border: "1px solid var(--border-primary)",
      textDecoration: "none",
      color: "var(--text-primary)",
      transition: "all 0.2s ease",
    }}
  >
    <div style={{ color: "var(--text-secondary)" }}>
      {React.cloneElement(icon as React.ReactElement, { size: 20 })}
    </div>
    <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{label}</span>
  </Link>
);

export const PostLoginLanding: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const next = useMemo(() => {
    const st = (location.state || {}) as LocationState;
    const candidate = st.next;
    if (!isSafeInternalPath(candidate)) return "/app/vault/library";
    // Avoid looping back to this page.
    if (candidate.startsWith("/apps/post-login")) return "/app/vault/library";
    if (candidate.startsWith("/apps/dashboard")) return "/app/vault/library";
    return candidate;
  }, [location.state]);

  const hasNext = next !== "/app/vault/library";

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "var(--space-6) var(--space-4)",
        animation: "fadeIn 0.4s ease-out",
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-8)",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 800,
            marginBottom: "var(--space-2)",
            background: "linear-gradient(to right, #fff, #aaa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            display: "inline-block",
          }}
        >
          Welcome Back
        </h1>
        <p style={{ fontSize: "1.1rem", color: "var(--text-secondary)" }}>
          Your digital sanctuary is ready.
        </p>
      </header>

      {hasNext && (
        <div
          style={{
            background: "rgba(0, 112, 243, 0.1)",
            border: "1px solid rgba(0, 112, 243, 0.2)",
            borderRadius: "16px",
            padding: "var(--space-4) var(--space-6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-4)",
            flexWrap: "wrap",
            maxWidth: "800px",
            margin: "0 auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                background: "var(--accent-primary)",
                borderRadius: "50%",
                padding: "6px",
                display: "flex",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  fontWeight: 500,
                }}
              >
                Recent Activity
              </div>
              <div style={{ fontWeight: 600, color: "var(--accent-primary)" }}>
                Resume where you left off
              </div>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate(next, { replace: true })}
            style={{ padding: "8px 24px", borderRadius: "99px" }}
          >
            Continue
          </button>
        </div>
      )}

      {/* Main Apps Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--space-6)",
          alignItems: "stretch",
        }}
      >
        <AppCard
          title="BoosterAi.me Vault"
          description="Your private, encrypted gallery for photos and videos. Zero-knowledge security standard."
          icon={<LockIcon />}
          to="/app/vault/library"
          primaryActionLabel="Open Vault"
          gradient="linear-gradient(135deg, #FF0080 0%, #7928CA 100%)"
          secondaryActions={[
            { label: "Search", to: "/app/vault/search" },
            { label: "Albums", to: "/app/vault/albums" },
          ]}
        />

        <AppCard
          title="Life Docs"
          description="Organize passports, contracts, and vital records with expiry tracking and reminders."
          icon={<DocIcon />}
          to="/apps/life-docs"
          primaryActionLabel="Manage Docs"
          badge="New"
          gradient="linear-gradient(135deg, #007CF0 0%, #00DFD8 100%)"
          secondaryActions={[
            { label: "Upload New", to: "/apps/life-docs/new" },
          ]}
        />
      </div>

      {/* Utilities Section */}
      <div style={{ marginTop: "var(--space-4)" }}>
        <h3
          style={{
            fontSize: "1.1rem",
            marginBottom: "var(--space-4)",
            color: "var(--text-secondary)",
            fontWeight: 600,
          }}
        >
          Quick Links
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          <QuickLink
            icon={<TimelineIconStub />}
            label="Timeline"
            to="/app/vault/timeline"
          />
          <QuickLink
            icon={<UsersIcon />}
            label="Shared Albums"
            to="/app/vault/shares"
          />
          <QuickLink
            icon={<CreditCardIcon />}
            label="Subscription"
            to="/app/vault/billing"
          />
          <QuickLink
            icon={<GlobeIcon />}
            label="Web Exports"
            to="/app/vault/exports"
          />
        </div>
      </div>
    </div>
  );
};
