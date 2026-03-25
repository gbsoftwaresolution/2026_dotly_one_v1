import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { LifeDocResponse, LifeDocStatus } from "@booster-vault/shared";
import { lifeDocsApi } from "../api/lifeDocs";
import { Loading } from "../components/Loading";
import { LifeDocsTabs } from "../components/LifeDocsTabs";
import {
  categoryLabel,
  effectiveSubcategoryLabel,
  statusColor,
  statusLabel,
  visibilityLabel,
} from "../utils/lifeDocs";
import {
  ShieldIcon,
  CreditCardIcon,
  UsersIcon,
  FileCodeIcon,
  SearchIcon,
  FolderIcon,
} from "../components/icons";

// Lazy import GlobeIcon to avoid breaking if not present
const GlobeIcon = ({ size = 24 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" x2="22" y1="12" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

interface CategoryMeta {
  label: string;
  icon: React.FC<any>;
  color: string;
  bg: string;
}

const CATEGORY_THEMES: Record<string, CategoryMeta> = {
  IDENTITY_LEGAL: {
    label: "Identity & Legal",
    icon: ShieldIcon,
    color: "#007AFF",
    bg: "rgba(0, 122, 255, 0.1)",
  },
  FINANCE_ASSETS: {
    label: "Finance & Assets",
    icon: CreditCardIcon,
    color: "#34C759",
    bg: "rgba(52, 199, 89, 0.1)",
  },
  MEDICAL_HEALTH: {
    label: "Medical",
    icon: UsersIcon,
    color: "#FF3B30",
    bg: "rgba(255, 59, 48, 0.1)",
  },
  EDUCATION_CAREER: {
    label: "Education",
    icon: FileCodeIcon,
    color: "#FF9500",
    bg: "rgba(255, 149, 0, 0.1)",
  },
  TRAVEL_VISAS: {
    label: "Travel",
    icon: GlobeIcon,
    color: "#5856D6",
    bg: "rgba(88, 86, 214, 0.1)",
  },
  INSURANCE: {
    label: "Insurance",
    icon: FileCodeIcon,
    color: "#AF52DE",
    bg: "rgba(175, 82, 222, 0.1)",
  },
};

const DEFAULT_THEME: CategoryMeta = {
  label: "Other",
  icon: FolderIcon,
  color: "#8E8E93",
  bg: "rgba(142, 142, 147, 0.1)",
};

function StatusPill({ status }: { status: LifeDocStatus }) {
  const color = statusColor(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: "12px",
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        color: color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        // border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      {statusLabel(status)}
    </span>
  );
}

function maskedTitle(doc: LifeDocResponse): string {
  if (!doc.maskedMode) return doc.title;
  const alias = String(doc.aliasTitle ?? "").trim();
  return alias || "Private document";
}

function maskedExpiry(doc: LifeDocResponse): string {
  if (!doc.maskedMode) return doc.expiryDate ?? "";
  if (doc.maskedHideExpiry) return "Expiry hidden";
  return doc.expiryDate ?? "";
}

export const LifeDocs: React.FC = () => {
  const [items, setItems] = useState<LifeDocResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | "ALL">("ALL");

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await lifeDocsApi.list();
        setItems(Array.isArray(res?.items) ? res.items : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load Life Docs");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(items.map((i) => i.category));
    return Array.from(cats);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (activeCategory !== "ALL" && item.category !== activeCategory)
          return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          maskedTitle(item).toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.issuingAuthority &&
            item.issuingAuthority.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const ae = a.expiryDate
          ? Date.parse(a.expiryDate)
          : Number.POSITIVE_INFINITY;
        const be = b.expiryDate
          ? Date.parse(b.expiryDate)
          : Number.POSITIVE_INFINITY;
        if (ae !== be) return ae - be;
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });
  }, [items, searchQuery, activeCategory]);

  if (isLoading) return <Loading message="Loading Life Docs..." />;

  return (
    <div className="lifeDocsPage">
      {/* Header */}
      <div className="lifeDocsHero" style={{ marginBottom: "var(--space-6)" }}>
        <div className="lifeDocsHeroInner">
          <div>
            <h1 className="lifeDocsHeroTitle">Life Docs</h1>
            <p className="lifeDocsHeroSubtitle">
              Your secure digital filing cabinet. Organize, track, and protect
              your vital documents.
            </p>
          </div>
          <div className="lifeDocsHeroActions">
            <Link
              to="/apps/life-docs/new"
              className="btn btn-primary"
              style={{
                padding: "10px 20px",
                borderRadius: "var(--radius-xl)",
                fontSize: "1rem",
                fontWeight: 600,
                boxShadow: "var(--shadow-md)",
              }}
            >
              <span
                style={{ fontSize: "1.2em", lineHeight: 1, marginRight: "8px" }}
              >
                +
              </span>{" "}
              New Document
            </Link>
          </div>
        </div>
      </div>

      <LifeDocsTabs />

      {/* Controls Area */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
          marginBottom: "var(--space-8)",
        }}
      >
        {/* Search Bar */}
        <div style={{ position: "relative", maxWidth: "480px" }}>
          <div
            style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-tertiary)",
              pointerEvents: "none",
            }}
          >
            <SearchIcon size={20} />
          </div>
          <input
            type="text"
            className="form-input"
            placeholder="Search by title, category, or authority..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 12px 12px 48px",
              fontSize: "1rem",
              background: "var(--bg-elevated)",
            }}
          />
        </div>

        {/* Category Filters */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            overflowX: "auto",
            paddingBottom: "8px",
            scrollbarWidth: "none",
            maskImage: "linear-gradient(to right, black 95%, transparent 100%)",
          }}
        >
          <button
            onClick={() => setActiveCategory("ALL")}
            style={{
              padding: "6px 16px",
              borderRadius: "var(--radius-full)",
              border:
                activeCategory === "ALL"
                  ? "1px solid var(--accent-primary)"
                  : "1px solid var(--border-primary)",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              background:
                activeCategory === "ALL"
                  ? "color-mix(in srgb, var(--accent-primary) 10%, transparent)"
                  : "var(--bg-elevated)",
              color:
                activeCategory === "ALL"
                  ? "var(--accent-primary)"
                  : "var(--text-secondary)",
              transition: "all var(--transition-fast)",
              whiteSpace: "nowrap",
            }}
          >
            All Documents
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "6px 16px",
                borderRadius: "var(--radius-full)",
                border:
                  activeCategory === cat
                    ? "1px solid var(--accent-primary)"
                    : "1px solid var(--border-primary)",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                background:
                  activeCategory === cat
                    ? "color-mix(in srgb, var(--accent-primary) 10%, transparent)"
                    : "var(--bg-elevated)",
                color:
                  activeCategory === cat
                    ? "var(--accent-primary)"
                    : "var(--text-secondary)",
                transition: "all var(--transition-fast)",
              }}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "var(--space-4)",
            background: "var(--danger-light)",
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            borderRadius: "var(--radius-lg)",
            marginBottom: "var(--space-8)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <ShieldIcon size={20} />
          {error}
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 && !error ? (
        <div
          className="card-elevated"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-16) var(--space-4)",
            textAlign: "center",
            border: "1px dashed var(--border-secondary)",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "40px",
              background: "var(--bg-tertiary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "var(--space-6)",
              color: "var(--text-tertiary)",
            }}
          >
            <FolderIcon size={40} />
          </div>
          <h3
            style={{
              margin: "0 0 var(--space-2)",
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            No Life Docs yet
          </h3>
          <p
            style={{
              color: "var(--text-secondary)",
              maxWidth: "440px",
              margin: "0 0 var(--space-8)",
              lineHeight: 1.6,
            }}
          >
            Start building your secure digital filing cabinet. Add passports,
            licenses, insurance policies, and more to keep them safe and
            accessible.
          </p>
          <Link to="/apps/life-docs/new" className="btn btn-secondary">
            Create your first Life Doc →
          </Link>
        </div>
      ) : (
        /* Grid */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "var(--space-6)",
          }}
        >
          {filteredItems.map((doc) => {
            const theme = CATEGORY_THEMES[doc.category] || DEFAULT_THEME;
            const Icon = theme.icon;

            return (
              <Link
                key={doc.id}
                to={`/apps/life-docs/${doc.id}`}
                className="card-elevated"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "var(--space-6)",
                  textDecoration: "none",
                  color: "inherit",
                  position: "relative",
                  transition:
                    "transform var(--transition-base), box-shadow var(--transition-base), border-color var(--transition-base)",
                  overflow: "hidden",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-xl)";
                  e.currentTarget.style.borderColor = "var(--accent-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                  e.currentTarget.style.borderColor = "var(--border-secondary)";
                }}
              >
                {/* Accent Top Border */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "4px",
                    background: theme.color,
                    opacity: 0.8,
                  }}
                />

                {/* Card Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "var(--space-5)",
                    marginTop: "var(--space-2)",
                  }}
                >
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "16px",
                      background: `color-mix(in srgb, ${theme.color} 15%, transparent)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: theme.color,
                    }}
                  >
                    <Icon size={28} />
                  </div>
                  {doc.maskedMode ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                        color: "var(--text-secondary)",
                        backgroundColor: "var(--bg-tertiary)",
                        border: "1px solid var(--border-secondary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      MASKED
                    </span>
                  ) : (
                    <StatusPill status={doc.status} />
                  )}
                </div>

                {/* Card Info */}
                <h3
                  style={{
                    margin: "0 0 var(--space-2) 0",
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    lineHeight: 1.3,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {maskedTitle(doc)}
                </h3>

                <div
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.95rem",
                    marginBottom: "var(--space-6)",
                    minHeight: "1.4em", // Maintain height for alignment
                  }}
                >
                  {doc.issuingAuthority
                    ? doc.issuingAuthority
                    : effectiveSubcategoryLabel(
                        doc.subcategory,
                        doc.customSubcategory,
                      )}
                </div>

                {/* Card Footer */}
                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: "var(--space-4)",
                    borderTop: "1px solid var(--border-secondary)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.85rem",
                    color: "var(--text-tertiary)",
                    fontWeight: 500,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background:
                          doc.visibility === "PRIVATE"
                            ? "var(--warning)"
                            : "var(--success)",
                      }}
                    ></div>
                    {visibilityLabel(doc.visibility)}
                  </div>
                  <span
                    style={{
                      color: doc.maskedMode
                        ? "inherit"
                        : doc.expiryDate &&
                            Date.parse(doc.expiryDate) <
                              Date.now() + 86400000 * 30
                          ? "var(--danger)"
                          : "inherit",
                    }}
                  >
                    {doc.maskedMode
                      ? maskedExpiry(doc) || "No expiry"
                      : doc.expiryDate
                        ? `Expires ${doc.expiryDate}`
                        : "No expiry"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
