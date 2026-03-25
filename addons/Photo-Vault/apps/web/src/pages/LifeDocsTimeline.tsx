import React, { useEffect, useMemo, useState } from "react";
import type {
  LifeDocResponse,
  LifeDocsTimelineResponse,
} from "@booster-vault/shared";
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

function maskedTitle(doc: LifeDocResponse): string {
  if (!doc.maskedMode) return doc.title;
  const alias = String(doc.aliasTitle ?? "").trim();
  return alias || "Private document";
}

function maskedExpiry(doc: LifeDocResponse): string {
  if (!doc.maskedMode) return doc.expiryDate ?? "—";
  if (doc.maskedHideExpiry) return "Expiry hidden";
  return doc.expiryDate ?? "—";
}

function MonthHeader({ month }: { month: string }) {
  const [y, m] = month.split("-");
  const label = `${y}-${m}`;
  return (
    <div
      style={{
        padding: "var(--space-4) var(--space-5)",
        borderRadius: "var(--radius-xl)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-primary)",
        fontWeight: 800,
        letterSpacing: "-0.01em",
      }}
    >
      {label}
    </div>
  );
}

export const LifeDocsTimeline: React.FC = () => {
  const [months, setMonths] = useState(12);
  const [data, setData] = useState<LifeDocsTimelineResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await lifeDocsApi.timeline({ months });
        setData(res);
      } catch (e: any) {
        setError(e?.message || "Failed to load timeline");
        setData(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [months]);

  const groups = useMemo(() => {
    return Array.isArray(data?.groups) ? data!.groups : [];
  }, [data]);

  if (isLoading) return <Loading message="Loading timeline..." />;

  return (
    <div className="lifeDocsPage" style={{ maxWidth: "1100px" }}>
      <div className="lifeDocsHero" style={{ marginBottom: "var(--space-6)" }}>
        <div className="lifeDocsHeroInner">
          <div>
            <h1 className="lifeDocsHeroTitle">Life Docs Timeline</h1>
            <p className="lifeDocsHeroSubtitle">
              A calm horizon view of upcoming expiries. No content scanning —
              only the metadata you provide.
            </p>
          </div>
        </div>
      </div>

      <LifeDocsTabs />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "var(--space-8)",
          flexWrap: "wrap",
        }}
      >
        <label style={{ color: "var(--text-secondary)", fontWeight: 700 }}>
          Horizon
        </label>
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="form-select"
          style={{ maxWidth: 200 }}
        >
          <option value={3}>3 months</option>
          <option value={6}>6 months</option>
          <option value={12}>12 months</option>
          <option value={24}>24 months</option>
          <option value={36}>36 months</option>
        </select>
        {error ? (
          <span style={{ color: "var(--danger)", fontWeight: 700 }}>
            {error}
          </span>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <div
          style={{
            padding: "var(--space-8)",
            border: "1px solid var(--border-primary)",
            borderRadius: "var(--radius-xl)",
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
          }}
        >
          No upcoming expiries in this horizon.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          {groups.map((g) => (
            <div
              key={g.month}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
              }}
            >
              <MonthHeader month={g.month} />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "var(--space-4)",
                }}
              >
                {g.items.map((doc) => (
                  <a
                    key={doc.id}
                    href={`/apps/life-docs/${doc.id}`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-primary)",
                      borderRadius: "var(--radius-xl)",
                      padding: "var(--space-5)",
                      transition:
                        "transform 0.15s ease, border-color 0.15s ease",
                    }}
                    className="hover-lift"
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: "1.15rem",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {maskedTitle(doc)}
                      </div>
                      <span
                        style={{
                          fontWeight: 900,
                          fontSize: "0.75rem",
                          padding: "4px 10px",
                          borderRadius: "var(--radius-full)",
                          color: doc.maskedMode
                            ? "var(--text-secondary)"
                            : statusColor(doc.status),
                          border: "1px solid var(--border-primary)",
                          background:
                            "color-mix(in srgb, var(--bg-elevated) 80%, transparent)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {doc.maskedMode
                          ? "MASKED"
                          : statusLabel(doc.status).toUpperCase()}
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: "var(--space-3)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {categoryLabel(doc.category)} •{" "}
                      {effectiveSubcategoryLabel(
                        doc.subcategory,
                        doc.customSubcategory,
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: "var(--space-4)",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        color: "var(--text-secondary)",
                        fontWeight: 700,
                      }}
                    >
                      <span>{visibilityLabel(doc.visibility)}</span>
                      <span>{maskedExpiry(doc)}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
