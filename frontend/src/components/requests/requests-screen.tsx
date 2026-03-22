"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  IncomingRequestCard,
  OutgoingRequestCard,
} from "@/components/requests/request-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { requestApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { routes } from "@/lib/constants/routes";
import { isExpiredSessionError } from "@/lib/utils/auth-errors";
import { cn } from "@/lib/utils/cn";
import type { IncomingRequest, OutgoingRequest } from "@/types/request";
import { useRouter } from "next/navigation";

type RequestTab = "incoming" | "outgoing";

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
  const [activeTab, setActiveTab] = useState<RequestTab>("incoming");
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [actionState, setActionState] = useState<{
    requestId: string;
    action: "approve" | "reject";
  } | null>(null);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
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
        router.refresh();
        return;
      }

      setLoadError(
        error instanceof ApiError
          ? error.message
          : "We could not load your requests right now.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadRequests();
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
        router.refresh();
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
      {/* Tab switcher */}
      <div className="rounded-[1.75rem] border border-border bg-surface/80 p-1 shadow-sm">
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
                  ? "bg-brandRose text-white shadow-sm dark:bg-brandCyan dark:text-zinc-950"
                  : "text-muted hover:bg-slate-100 hover:text-foreground dark:hover:bg-zinc-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {feedback ? (
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            feedback.tone === "success"
              ? "border border-emerald-500/30 bg-emerald-500/10"
              : "border border-rose-500/30 bg-rose-500/10",
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
        <div className="space-y-3">
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
          <div className="flex flex-col gap-3">
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
        <div className="flex flex-col gap-3">
          {outgoing.map((request) => (
            <OutgoingRequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </section>
  );
}
