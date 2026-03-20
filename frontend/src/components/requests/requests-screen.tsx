"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  IncomingRequestCard,
  OutgoingRequestCard,
} from "@/components/requests/request-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PrimaryButton } from "@/components/shared/primary-button";
import { requestApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { IncomingRequest, OutgoingRequest } from "@/types/request";

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

  async function loadRequests() {
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
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "We could not load your requests right now.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

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
      <div className="rounded-3xl border border-border bg-surface/80 p-1 shadow-sm">
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
                "min-h-12 rounded-[1.25rem] px-4 text-sm font-semibold transition",
                activeTab === tab
                  ? "bg-slate-900 text-white"
                  : "text-muted hover:bg-slate-100 hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {feedback ? (
        <p
          className={cn(
            "rounded-2xl px-4 py-3 text-sm",
            feedback.tone === "success"
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-rose-200 bg-rose-50 text-rose-700",
          )}
        >
          {feedback.message}
        </p>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <div className="rounded-3xl border border-border bg-surface/70 px-5 py-6 text-sm text-muted">
            Loading your requests...
          </div>
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
            title="No incoming requests"
            description="When someone requests access to one of your public personas, it will appear here."
          />
        ) : (
          <div className="space-y-3">
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
          title="No outgoing requests"
          description="Requests you send from your personas will appear here with their latest status."
          action={
            <Link href={routes.app.personas} className="block">
              <PrimaryButton className="w-full">
                Browse your personas
              </PrimaryButton>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {outgoing.map((request) => (
            <OutgoingRequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </section>
  );
}
