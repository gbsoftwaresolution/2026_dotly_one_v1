import React from "react";
import { NavLink, useLocation } from "react-router-dom";

// Icons as components for cleanliness
const Icons = {
  Library: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  Timeline: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Filters: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    >
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  ),
  Search: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Albums: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Trash: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Exports: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Billing: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  Settings: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Shares: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  Apps: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  LifeDocs: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  ),
  Plus: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
};

type NavItem = {
  path: string;
  label: string;
  icon: React.ReactNode;
  isActive?: (pathname: string) => boolean;
};

const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <li
    className="nav-item"
    style={{
      margin: "14px 8px 8px",
      fontSize: "0.72rem",
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--text-tertiary)",
      opacity: 0.9,
    }}
  >
    {label}
  </li>
);

const appSwitcherItems: NavItem[] = [
  {
    path: "/apps/dashboard",
    label: "Dashboard",
    icon: <Icons.Apps />,
    isActive: (p) => p.startsWith("/apps/dashboard") || p === "/apps",
  },
  {
    path: "/apps/card",
    label: "Card",
    icon: <Icons.Apps />,
    isActive: (p) => p.startsWith("/apps/card"),
  },
  {
    path: "/app/vault/library",
    label: "Vault",
    icon: <Icons.Library />,
    isActive: (p) => p.startsWith("/app/vault"),
  },
  {
    path: "/apps/life-docs",
    label: "Life Docs",
    icon: <Icons.LifeDocs />,
    isActive: (p) => p.startsWith("/apps/life-docs"),
  },
];

const vaultItems: NavItem[] = [
  { path: "/app/vault/library", label: "Library", icon: <Icons.Library /> },
  { path: "/app/vault/timeline", label: "Timeline", icon: <Icons.Timeline /> },
  { path: "/app/vault/filters", label: "Filters", icon: <Icons.Filters /> },
  { path: "/app/vault/search", label: "Search", icon: <Icons.Search /> },
  {
    path: "/app/vault/albums",
    label: "Albums",
    icon: <Icons.Albums />,
    isActive: (p) =>
      p === "/app/vault/albums" || p.startsWith("/app/vault/albums/"),
  },
  { path: "/app/vault/shares", label: "Shares", icon: <Icons.Shares /> },
  { path: "/app/vault/trash", label: "Trash", icon: <Icons.Trash /> },
  { path: "/app/vault/exports", label: "Exports", icon: <Icons.Exports /> },
];

const lifeDocsItems: NavItem[] = [
  {
    path: "/apps/life-docs",
    label: "All Docs",
    icon: <Icons.LifeDocs />,
    isActive: (p) =>
      p.startsWith("/apps/life-docs") && !p.startsWith("/apps/life-docs/new"),
  },
  {
    path: "/apps/life-docs/new",
    label: "New",
    icon: <Icons.Plus />,
    isActive: (p) => p.startsWith("/apps/life-docs/new"),
  },
];

const dashboardItems: NavItem[] = [
  {
    path: "/apps/dashboard",
    label: "Overview",
    icon: <Icons.Apps />,
    isActive: (p) => p.startsWith("/apps/dashboard") || p === "/apps",
  },
];

const accountItems: NavItem[] = [
  { path: "/app/vault/billing", label: "Billing", icon: <Icons.Billing /> },
  { path: "/app/vault/settings", label: "Settings", icon: <Icons.Settings /> },
];

function renderNavItems(items: NavItem[], pathname: string) {
  return items.map((item) => {
    const isActive = item.isActive
      ? item.isActive(pathname)
      : pathname === item.path || pathname.startsWith(`${item.path}/`);

    return (
      <li key={item.path} className="nav-item">
        <NavLink
          to={item.path}
          className={`nav-link ${isActive ? "active" : ""}`}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </NavLink>
      </li>
    );
  });
}

export const SideNav: React.FC = () => {
  const location = useLocation();
  const pathname = location.pathname;

  const isVault = pathname.startsWith("/app/vault");
  const isApps = pathname.startsWith("/apps");
  const isLifeDocs = pathname.startsWith("/apps/life-docs");

  const primaryItems = isVault
    ? vaultItems
    : isLifeDocs
      ? lifeDocsItems
      : dashboardItems;

  return (
    <nav className="side-nav">
      <ul className="nav-list">
        <SectionLabel label="Apps" />
        {renderNavItems(appSwitcherItems, pathname)}

        <SectionLabel
          label={isVault ? "Vault" : isLifeDocs ? "Life Docs" : "Dashboard"}
        />
        {renderNavItems(primaryItems, pathname)}

        {isApps && (
          <>
            <SectionLabel label="Account" />
            {renderNavItems(
              isLifeDocs
                ? accountItems.filter((i) => i.path !== "/app/vault/settings")
                : accountItems,
              pathname,
            )}
          </>
        )}
      </ul>
    </nav>
  );
};
