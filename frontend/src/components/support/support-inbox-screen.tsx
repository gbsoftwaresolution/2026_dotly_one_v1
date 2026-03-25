"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { supportApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { SupportInboxItem } from "@/types/support";

type Filter = "all" | "open" | "resolved";

export function SupportInboxScreen() {
  const [requests, setRequests] = useState<SupportInboxItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await supportApi.listInbox(
          filter === "all" ? undefined : filter,
        );
        setRequests(result.requests);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load support requests.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [filter]);

  async function toggleStatus(item: SupportInboxItem) {
    setUpdatingId(item.id);

    try {
      const updated = await supportApi.updateInboxStatus(
        item.id,
        item.status === "open" ? "resolved" : "open",
      );

      setRequests((current) =>
        current.map((entry) => (entry.id === item.id ? updated : entry)),
      );
    } catch (updateError) {
      setError(
        updateError instanceof ApiError
          ? updateError.message
          : "Unable to update support request.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
        {[...Array(3)].map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState title="Could not load support inbox" description={error} />
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
        <div className="mb-4 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Step 1
          </p>
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Queue filters
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "open", "resolved"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={[
                "rounded-pill px-4 py-2 text-sm font-semibold transition-colors ring-1",
                filter === value
                  ? "bg-foreground text-background ring-black/10 dark:bg-white dark:text-slate-950 dark:ring-white/10"
                  : "bg-foreground/[0.03] text-muted ring-black/5 hover:text-foreground dark:bg-white/[0.045] dark:ring-white/10",
              ].join(" ")}
            >
              {value === "all" ? "All" : value === "open" ? "Open" : "Resolved"}
            </button>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No support requests"
          description={
            filter === "resolved"
              ? "No resolved requests match this view yet."
              : filter === "open"
                ? "No open requests are waiting in the inbox right now."
                : "New support submissions will appear here once they are received."
          }
        />
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <article
              key={request.id}
              className="rounded-[28px] bg-white/80 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 transition-all duration-500 ease-[0.16,1,0.3,1] hover:scale-[0.995] motion-safe:animate-[fade-in_420ms_ease-out] dark:bg-zinc-950/80 dark:ring-white/[0.06]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">
                      {request.topic}
                    </h2>
                    <StatusBadge
                      label={request.status === "open" ? "Open" : "Resolved"}
                      tone={request.status === "open" ? "warning" : "success"}
                      dot
                    />
                    <StatusBadge
                      label={request.delivery}
                      tone={
                        request.delivery === "sent"
                          ? "cyan"
                          : request.delivery === "failed"
                            ? "error"
                            : "neutral"
                      }
                    />
                  </div>
                  <p className="text-sm text-muted">
                    Ref {request.referenceId} - {request.requesterEmailMasked}
                  </p>
                  {request.requesterName ? (
                    <p className="text-sm font-medium text-foreground/80">
                      {request.requesterName}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/85">
                    {request.details}
                  </p>
                </div>

                <div className="flex flex-col items-start gap-3 sm:items-end">
                  <p className="text-xs font-medium text-muted">
                    {new Date(request.createdAt).toLocaleString()}
                  </p>
                  <button
                    type="button"
                    disabled={updatingId === request.id}
                    onClick={() => void toggleStatus(request)}
                    className="rounded-pill bg-foreground/[0.04] px-4 py-2 text-sm font-semibold text-foreground shadow-inner ring-1 ring-black/5 transition-colors hover:bg-foreground/[0.06] disabled:opacity-50 dark:bg-white/[0.05] dark:ring-white/10"
                  >
                    {updatingId === request.id
                      ? "Updating..."
                      : request.status === "open"
                        ? "Mark resolved"
                        : "Reopen"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
