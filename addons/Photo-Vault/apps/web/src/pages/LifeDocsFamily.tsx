import React, { useEffect, useState } from "react";
import { lifeDocsApi } from "../api/lifeDocs";
import { Loading } from "../components/Loading";
import { LifeDocsTabs } from "../components/LifeDocsTabs";

type CardProps = {
  title: string;
  value: number;
  hint: string;
};

function StatCard({ title, value, hint }: CardProps) {
  return (
    <div
      style={{
        padding: "var(--space-6)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-xl)",
      }}
    >
      <div
        style={{
          color: "var(--text-secondary)",
          fontWeight: 800,
          fontSize: "0.95rem",
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: "var(--space-2)",
          fontSize: "2.25rem",
          fontWeight: 950,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
      <div
        style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)" }}
      >
        {hint}
      </div>
    </div>
  );
}

export const LifeDocsFamily: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    myExpiringSoon: number;
    childrenExpiringSoon: number;
    sharedWithMe: number;
    needsRenewal: number;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await lifeDocsApi.familyOverview();
        setData(res);
      } catch (e: any) {
        setError(e?.message || "Failed to load family overview");
        setData(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) return <Loading message="Loading family dashboard..." />;

  return (
    <div className="lifeDocsPage" style={{ maxWidth: "1100px" }}>
      <div className="lifeDocsHero" style={{ marginBottom: "var(--space-6)" }}>
        <div className="lifeDocsHeroInner">
          <div>
            <h1 className="lifeDocsHeroTitle">Family</h1>
            <p className="lifeDocsHeroSubtitle">
              A lightweight overview for shared and guardian-visible documents.
              No OCR, no content analysis — metadata only.
            </p>
          </div>
        </div>
      </div>

      <LifeDocsTabs />

      {error ? (
        <div
          style={{
            padding: "var(--space-6)",
            borderRadius: "var(--radius-xl)",
            background: "var(--danger-light)",
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            fontWeight: 800,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-4)",
          marginTop: "var(--space-6)",
        }}
      >
        <StatCard
          title="My expiring soon"
          value={data?.myExpiringSoon ?? 0}
          hint="Items in your vault approaching expiry."
        />
        <StatCard
          title="Children expiring soon"
          value={data?.childrenExpiringSoon ?? 0}
          hint="Guardian-visible items nearing expiry."
        />
        <StatCard
          title="Shared with me"
          value={data?.sharedWithMe ?? 0}
          hint="Documents you can view or manage."
        />
        <StatCard
          title="Needs renewal"
          value={data?.needsRenewal ?? 0}
          hint="Upcoming or in-progress renewal workflows."
        />
      </div>

      <div
        style={{
          marginTop: "var(--space-8)",
          padding: "var(--space-6)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border-primary)",
          background: "var(--bg-elevated)",
          color: "var(--text-secondary)",
        }}
      >
        Tip: Use masked mode for any document that you don’t want visible at a
        glance. You’ll be asked to explicitly reveal details before viewing.
      </div>
    </div>
  );
};
