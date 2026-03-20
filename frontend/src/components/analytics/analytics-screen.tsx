"use client";

import { useEffect, useState } from "react";

import {
  PersonaInsightRow,
  type PersonaWithAnalytics,
} from "@/components/analytics/persona-insight-row";
import { StatCard } from "@/components/analytics/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { analyticsApi, personaApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { AnalyticsSummary } from "@/types/analytics";

interface PersonaRowState extends PersonaWithAnalytics {
  isRefreshing?: boolean;
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4 dark:border-zinc-900 dark:bg-zinc-950 flex flex-col justify-between"
        >
          <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-zinc-900" />
          <div className="mt-2 h-7 w-1/2 rounded bg-slate-100 dark:bg-zinc-900" />
        </div>
      ))}
    </div>
  );
}

export function AnalyticsScreen() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [personaRows, setPersonaRows] = useState<PersonaRowState[]>([]);
  const [personasLoading, setPersonasLoading] = useState(true);
  const [personasError, setPersonasError] = useState<string | null>(null);

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
      try {
        const result = await analyticsApi.getSummary();
        setSummary(result);
      } catch (error) {
        setSummaryError(
          error instanceof ApiError
            ? error.message
            : "Unable to load analytics summary right now.",
        );
      } finally {
        setSummaryLoading(false);
      }
    }

    void loadSummary();
  }, []);

  useEffect(() => {
    async function loadPersonas() {
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
        setPersonasError(
          error instanceof ApiError
            ? error.message
            : "Unable to load personas right now.",
        );
        setPersonasLoading(false);
      }
    }

    void loadPersonas();
  }, []);

  const hasSummaryData =
    summary &&
    (summary.totalProfileViews > 0 ||
      summary.totalQrScans > 0 ||
      summary.totalRequests > 0 ||
      summary.totalApproved > 0 ||
      summary.totalContacts > 0);

  return (
    <div className="space-y-8">
      {/* Summary section */}
      <section className="space-y-3">
        <h2 className="font-sans text-xs font-bold uppercase tracking-widest text-muted">
          Global Hub
        </h2>

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
              <StatCard label="Requests" value={summary.totalRequests} />
              <StatCard label="Approved" value={summary.totalApproved} />
              <StatCard
                label="Total Contacts"
                value={summary.totalContacts}
                highlight={summary.totalContacts > 0}
              />
            </div>
          ) : (
            <EmptyState
              title="No Data Signals"
              description="Share your QR code to start generating insights."
            />
          )
        ) : null}
      </section>

      {/* Per-persona breakdown */}
      <section className="space-y-3">
        <h2 className="font-sans text-xs font-bold uppercase tracking-widest text-muted">
          Persona Insights
        </h2>

        {personasLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-3xl border border-slate-100 bg-white p-5 dark:border-zinc-900 dark:bg-zinc-950"
              >
                <div className="mb-4 space-y-1">
                  <div className="h-4 w-1/3 rounded bg-slate-100 dark:bg-zinc-900" />
                  <div className="h-3 w-1/4 rounded bg-slate-100 dark:bg-zinc-900" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="space-y-1">
                      <div className="h-2 w-full rounded bg-slate-100 dark:bg-zinc-900" />
                      <div className="h-4 w-2/3 rounded bg-slate-100 dark:bg-zinc-900" />
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
            description="Create a persona to start tracking analytics."
          />
        ) : (
          <div className="space-y-3">
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
