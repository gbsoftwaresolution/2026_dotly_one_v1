"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  IncomingRequestCard,
  OutgoingRequestCard,
} from "@/components/requests/request-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { requestApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import {
  readSessionCache,
  writeSessionCache,
} from "@/lib/client-session-cache";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { routes } from "@/lib/constants/routes";
import { isExpiredSessionError } from "@/lib/utils/auth-errors";
import { cn } from "@/lib/utils/cn";
import type { IncomingRequest, OutgoingRequest } from "@/types/request";
import { useRouter } from "next/navigation";

type RequestTab = "incoming" | "outgoing";

const REQUESTS_CACHE_KEY = "dotly.requests-screen";

type RequestsCacheValue = {
  incoming: IncomingRequest[];
  outgoing: OutgoingRequest[];
};

function toFriendlyActionError(error: unknown, action: "approve" | "reject") {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return `You are not allowed to ${action} this request.`;
    }

    if (error.status === 409) {
      return action === "approve"
        ? "This request is no longer pending."
        : "This request has already been handled.";
    }

    return error.message;
  }

  return `We could not ${action} this request right now.`;
}

export function RequestsScreen() {
  const router = useRouter();
  const initialCacheRef = useRef(
    readSessionCache<RequestsCacheValue>(REQUESTS_CACHE_KEY),
  );
  const [activeTab, setActiveTab] = useState<RequestTab>("incoming");
  const [incoming, setIncoming] = useState<IncomingRequest[]>(
    () => initialCacheRef.current?.incoming ?? [],
  );
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>(
    () => initialCacheRef.current?.outgoing ?? [],
  );
  const [isLoading, setIsLoading] = useState(
    () => initialCacheRef.current === null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [actionState, setActionState] = useState<{
    requestId: string;
    action: "approve" | "reject";
  } | null>(null);

  useEffect(() => {
    writeSessionCache(REQUESTS_CACHE_KEY, { incoming, outgoing });
  }, [incoming, outgoing]);

  const loadRequests = useCallback(
    async (withLoading = true) => {
      if (withLoading) {
        setIsLoading(true);
      }

      setLoadError(null);

      try {
        const [nextIncoming, nextOutgoing] = await Promise.all([
          requestApi.listIncoming(),
          requestApi.listOutgoing(),
        ]);

        setIncoming(nextIncoming);
        setOutgoing(nextOutgoing);
      } catch (error) {
        if (isExpiredSessionError(error)) {
          router.replace(
            `/login?next=${encodeURIComponent(routes.app.requests)}&reason=expired`,
          );
          return;
        }

        setLoadError(
          error instanceof ApiError
            ? error.message
            : "We could not load your requests right now.",
        );
      } finally {
        if (withLoading) {
          setIsLoading(false);
        }
      }
    },
    [router],
  );

  useEffect(() => {
    void loadRequests(initialCacheRef.current === null);
  }, [loadRequests]);

  const visibleRequests = useMemo(
    () => (activeTab === "incoming" ? incoming : outgoing),
    [activeTab, incoming, outgoing],
  );

  async function handleIncomingAction(
    requestId: string,
    action: "approve" | "reject",
  ) {
    setFeedback(null);
    setActionState({ requestId, action });

    try {
      if (action === "approve") {
        await requestApi.approve(requestId);
        setFeedback({ tone: "success", message: "Request approved." });
      } else {
        await requestApi.reject(requestId);
        setFeedback({ tone: "success", message: "Request rejected." });
      }

      setIncoming((current) =>
        current.filter((request) => request.id !== requestId),
      );
      void loadRequests();
    } catch (error) {
      if (isExpiredSessionError(error)) {
        router.replace(
          `/login?next=${encodeURIComponent(routes.app.requests)}&reason=expired`,
        );
        return;
      }

      setFeedback({
        tone: "error",
        message: toFriendlyActionError(error, action),
      });
    } finally {
      setActionState(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
        <div className="mb-4 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Step 1
          </p>
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Request lanes
          </h2>
        </div>

        <div className="rounded-[1.75rem] bg-foreground/[0.03] p-1 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                ["incoming", "Incoming"],
                ["outgoing", "Outgoing"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "min-h-12 rounded-[1.25rem] px-4 font-mono text-[11px] font-semibold uppercase tracking-widest transition-all",
                  activeTab === tab
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted hover:bg-foreground/[0.05] hover:text-foreground dark:hover:bg-white/[0.06]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {feedback ? (
        <div
          className={cn(
            "rounded-2xl px-4 py-3 ring-1 ring-inset",
            feedback.tone === "success"
              ? "bg-emerald-500/5 ring-emerald-500/20"
              : "bg-rose-500/5 ring-rose-500/20",
          )}
        >
          <p
            className={cn(
              "font-mono text-sm",
              feedback.tone === "success"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-500 dark:text-rose-400",
            )}
          >
            {feedback.message}
          </p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-3 rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : loadError ? (
        <EmptyState
          title="Requests are unavailable"
          description={loadError}
          action={
            <PrimaryButton
              className="w-full"
              onClick={() => void loadRequests()}
            >
              Try again
            </PrimaryButton>
          }
        />
      ) : activeTab === "incoming" ? (
        incoming.length === 0 ? (
          <EmptyState
            title="No requests yet"
            description={dotlyPositioning.app.noRequests}
          />
        ) : (
          <div className="overflow-hidden rounded-3xl bg-white/40 backdrop-blur-[40px] saturate-[200%] shadow-sm ring-[0.5px] ring-black/5 dark:bg-black/40 dark:ring-white/10 divide-y divide-black/5 dark:divide-white/5">
            {incoming.map((request) => (
              <IncomingRequestCard
                key={request.id}
                request={request}
                isApproving={
                  actionState?.requestId === request.id &&
                  actionState.action === "approve"
                }
                isRejecting={
                  actionState?.requestId === request.id &&
                  actionState.action === "reject"
                }
                onApprove={(requestId) =>
                  void handleIncomingAction(requestId, "approve")
                }
                onReject={(requestId) =>
                  void handleIncomingAction(requestId, "reject")
                }
              />
            ))}
          </div>
        )
      ) : visibleRequests.length === 0 ? (
        <EmptyState
          title="No requests yet"
          description={dotlyPositioning.app.noRequests}
          action={
            <Link href={routes.app.personas} className="block">
              <PrimaryButton className="w-full">
                Browse your personas
              </PrimaryButton>
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-3xl bg-white/40 backdrop-blur-[40px] saturate-[200%] shadow-sm ring-[0.5px] ring-black/5 dark:bg-black/40 dark:ring-white/10 divide-y divide-black/5 dark:divide-white/5">
          {outgoing.map((request) => (
            <OutgoingRequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </section>
  );
}
