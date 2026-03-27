"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  PersonaInsightRow,
  type PersonaWithAnalytics,
} from "@/components/analytics/persona-insight-row";
import { StatCard } from "@/components/analytics/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { analyticsApi, personaApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import {
  readSessionCache,
  writeSessionCache,
} from "@/lib/client-session-cache";
import { routes } from "@/lib/constants/routes";
import { isExpiredSessionError } from "@/lib/utils/auth-errors";
import type { AnalyticsSummary } from "@/types/analytics";

interface PersonaRowState extends PersonaWithAnalytics {
  isRefreshing?: boolean;
}

const ANALYTICS_CACHE_KEY = "dotly.analytics-screen";

type AnalyticsCacheValue = {
  summary: AnalyticsSummary | null;
  personaRows: PersonaRowState[];
};

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="skeleton rounded-2xl bg-foreground/[0.03] p-4 flex flex-col justify-between shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5"
        >
          <div className="h-2.5 w-2/3 rounded-full bg-current opacity-10" />
          <div className="mt-3 h-6 w-1/2 rounded-full bg-current opacity-10" />
        </div>
      ))}
    </div>
  );
}

export function AnalyticsScreen() {
  const router = useRouter();
  const initialCacheRef = useRef(
    readSessionCache<AnalyticsCacheValue>(ANALYTICS_CACHE_KEY),
  );
  const [summary, setSummary] = useState<AnalyticsSummary | null>(
    () => initialCacheRef.current?.summary ?? null,
  );
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(
    () => initialCacheRef.current === null,
  );

  const [personaRows, setPersonaRows] = useState<PersonaRowState[]>(
    () => initialCacheRef.current?.personaRows ?? [],
  );
  const [personasLoading, setPersonasLoading] = useState(
    () => initialCacheRef.current === null,
  );
  const [personasError, setPersonasError] = useState<string | null>(null);

  useEffect(() => {
    writeSessionCache(ANALYTICS_CACHE_KEY, {
      summary,
      personaRows,
    });
  }, [personaRows, summary]);

  async function loadPersonaAnalytics(personaId: string) {
    setPersonaRows((prev) =>
      prev.map((row) =>
        row.persona.id === personaId
          ? { ...row, error: null, isRefreshing: true }
          : row,
      ),
    );

    try {
      const result = await analyticsApi.getPersona(personaId);
      setPersonaRows((prev) =>
        prev.map((row) =>
          row.persona.id === personaId
            ? { ...row, analytics: result, error: null, isRefreshing: false }
            : row,
        ),
      );
    } catch (error) {
      if (isExpiredSessionError(error)) {
        router.replace(
          `/login?next=${encodeURIComponent(routes.app.analytics)}&reason=expired`,
        );
        return;
      }

      setPersonaRows((prev) =>
        prev.map((row) =>
          row.persona.id === personaId
            ? {
                ...row,
                analytics: row.analytics,
                error:
                  error instanceof ApiError
                    ? error.message
                    : "Could not load analytics.",
                isRefreshing: false,
              }
            : row,
        ),
      );
    }
  }

  useEffect(() => {
    async function loadSummary() {
      if (initialCacheRef.current === null) {
        setSummaryLoading(true);
      }

      try {
        const result = await analyticsApi.getSummary();
        setSummary(result);
      } catch (error) {
        if (isExpiredSessionError(error)) {
          router.replace(
            `/login?next=${encodeURIComponent(routes.app.analytics)}&reason=expired`,
          );
          return;
        }

        setSummaryError(
          error instanceof ApiError
            ? error.message
            : "Unable to load analytics summary right now.",
        );
      } finally {
        if (initialCacheRef.current === null) {
          setSummaryLoading(false);
        }
      }
    }

    void loadSummary();
  }, [router]);

  useEffect(() => {
    async function loadPersonas() {
      if (initialCacheRef.current === null) {
        setPersonasLoading(true);
      }

      try {
        const personas = await personaApi.list();

        const rows: PersonaRowState[] = personas.map((p) => ({
          persona: p,
          analytics: null,
          error: null,
          isRefreshing: false,
        }));
        setPersonaRows(rows);
        setPersonasLoading(false);

        const results = await Promise.allSettled(
          personas.map((p) => analyticsApi.getPersona(p.id)),
        );

        setPersonaRows(
          personas.map((p, i) => {
            const result = results[i];
            if (result.status === "fulfilled") {
              return {
                persona: p,
                analytics: result.value,
                error: null,
                isRefreshing: false,
              };
            }
            return {
              persona: p,
              analytics: null,
              error:
                result.reason instanceof ApiError
                  ? result.reason.message
                  : "Could not load analytics.",
              isRefreshing: false,
            };
          }),
        );
      } catch (error) {
        if (isExpiredSessionError(error)) {
          router.replace(
            `/login?next=${encodeURIComponent(routes.app.analytics)}&reason=expired`,
          );
          return;
        }

        setPersonasError(
          error instanceof ApiError
            ? error.message
            : "Unable to load personas right now.",
        );
        if (initialCacheRef.current === null) {
          setPersonasLoading(false);
        }
        return;
      }

      if (initialCacheRef.current === null) {
        setPersonasLoading(false);
      }
    }

    void loadPersonas();
  }, [router]);

  const hasSummaryData =
    summary &&
    (summary.totalProfileViews > 0 ||
      summary.totalQrScans > 0 ||
      summary.totalRequests > 0 ||
      summary.totalApproved > 0 ||
      summary.totalContacts > 0 ||
      summary.totalVerificationEmailsIssued > 0 ||
      summary.totalVerificationResends > 0 ||
      summary.totalVerificationCompleted > 0 ||
      summary.totalVerificationBlocks > 0);

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="flex flex-col gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Trust network pulse
          </h2>
          <p className="text-sm leading-6 text-muted">
            Read the quality of your introductions, response momentum, and trust
            signals at a glance.
          </p>
        </div>

        {summaryLoading ? (
          <SummarySkeleton />
        ) : summaryError ? (
          <EmptyState title="Summary unavailable" description={summaryError} />
        ) : summary ? (
          hasSummaryData ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                label="Profile Views"
                value={summary.totalProfileViews}
              />
              <StatCard label="QR Scans" value={summary.totalQrScans} />
              <StatCard label="Introductions" value={summary.totalRequests} />
              <StatCard label="Welcomed" value={summary.totalApproved} />
              <StatCard
                label="Trusted Contacts"
                value={summary.totalContacts}
                highlight={summary.totalContacts > 0}
              />
              <StatCard
                label="Trust Emails"
                value={summary.totalVerificationEmailsIssued}
                highlight={summary.totalVerificationEmailsIssued > 0}
              />
              <StatCard
                label="Verified People"
                value={summary.totalVerificationCompleted}
                highlight={summary.totalVerificationCompleted > 0}
              />
              <StatCard
                label="Verification Resends"
                value={summary.totalVerificationResends}
              />
              <StatCard
                label="Trust Protections"
                value={summary.totalVerificationBlocks}
                highlight={summary.totalVerificationBlocks > 0}
              />
              <StatCard
                label="Verify Rate"
                value={`${summary.verificationConversionRate.toFixed(2)}%`}
                highlight={summary.verificationConversionRate > 0}
              />
            </div>
          ) : (
            <EmptyState
              title="No relationship signals yet"
              description="Share your Dotly in a real conversation to start building insight across scans, requests, and trusted contacts."
            />
          )
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Persona insights
          </h2>
          <p className="text-sm leading-6 text-muted">
            See which personas are opening doors, earning trust, and keeping
            momentum after the first exchange.
          </p>
        </div>

        {personasLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="skeleton rounded-3xl bg-foreground/[0.03] p-5 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5"
              >
                <div className="mb-4 space-y-2">
                  <div className="h-4 w-1/3 rounded-full bg-current opacity-10" />
                  <div className="h-3 w-1/4 rounded-full bg-current opacity-10" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="space-y-1">
                      <div className="h-2 w-full rounded-full bg-current opacity-10" />
                      <div className="h-4 w-2/3 rounded-full bg-current opacity-10" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : personasError ? (
          <EmptyState
            title="Personas unavailable"
            description={personasError}
          />
        ) : personaRows.length === 0 ? (
          <EmptyState
            title="No personas yet"
            description="Create a persona to start measuring how your Dotly identities perform in the real world."
          />
        ) : (
          <div className="flex flex-col overflow-hidden rounded-[1.25rem] bg-foreground/[0.02] backdrop-blur-[40px] saturate-[200%] ring-[0.5px] ring-black/5 dark:bg-white/[0.03] dark:ring-white/10 shadow-sm divide-y divide-black/5 dark:divide-white/5">
            {personaRows.map((row) => (
              <PersonaInsightRow
                key={row.persona.id}
                {...row}
                onClick={() => void loadPersonaAnalytics(row.persona.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
