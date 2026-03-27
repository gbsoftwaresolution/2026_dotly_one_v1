"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ProtectedConversationScreen } from "@/components/connections/protected/protected-conversation-screen";
import { EmptyState } from "@/components/shared/empty-state";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { routes } from "@/lib/constants/routes";

import { useConversationDetailData } from "./use-conversation-detail-data";

interface ConversationDetailRouteProps {
  conversationId: string;
  variant?: "app";
}

export function ConversationDetailRoute({
  conversationId,
  variant = "app",
}: ConversationDetailRouteProps) {
  const router = useRouter();
  const {
    conversation,
    routingPersona,
    connection,
    permissions,
    permissionsExplanation,
    isLoading,
    error,
    reload,
  } = useConversationDetailData(conversationId);

  useEffect(() => {
    if (variant !== "app" || error?.kind !== "unauthorized") {
      return;
    }

    router.replace(
      `/login?next=${encodeURIComponent(routes.app.conversationDetail(conversationId))}&reason=expired`,
    );
  }, [conversationId, error?.kind, router, variant]);

  const appErrorCopy =
    error?.kind === "forbidden"
      ? {
          title: "This conversation is not available to you",
          description:
            "This conversation is shared only with the people currently assigned to it. If you need access, ask an owner or workspace admin to update your coverage.",
        }
      : error?.kind === "not-found"
        ? {
            title: "This conversation could not be found",
            description:
              "It may have been archived, removed, or moved out of this inbox view.",
          }
        : {
            title: "We couldn't load this conversation",
            description: error?.message ?? "Please try again in a moment.",
          };

  if (isLoading) {
    if (variant === "app") {
      return (
        <div className="space-y-5">
          <Link
            className="inline-flex items-center gap-2 text-base font-semibold text-sky-700 transition-colors hover:text-sky-800"
            href={routes.app.inbox}
          >
            <ArrowLeft className="h-5 w-5" />
            Back to inbox
          </Link>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4 rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] sm:p-6">
              <SkeletonCard rows={3} />
              <SkeletonCard rows={4} />
            </div>
            <div className="space-y-4">
              <SkeletonCard rows={3} />
              <SkeletonCard rows={3} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
        <div className="h-8 w-44 rounded-2xl bg-slate-200/80 animate-pulse dark:bg-white/10" />
        <div className="h-40 w-full rounded-[1.75rem] bg-slate-200/80 animate-pulse dark:bg-white/10" />
        <div className="h-[28rem] w-full rounded-[1.75rem] bg-slate-200/80 animate-pulse dark:bg-white/10" />
      </div>
    );
  }

  if (error || !conversation?.connectionId || !connection) {
    if (variant === "app") {
      if (error?.kind === "unauthorized") {
        return (
          <div className="space-y-4 rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
            <div className="h-8 w-44 rounded-2xl bg-slate-200/80 animate-pulse dark:bg-white/10" />
            <div className="h-40 w-full rounded-[1.75rem] bg-slate-200/80 animate-pulse dark:bg-white/10" />
          </div>
        );
      }

      return (
        <div className="space-y-5">
          <Link
            className="inline-flex items-center gap-2 text-base font-semibold text-sky-700 transition-colors hover:text-sky-800"
            href={routes.app.inbox}
          >
            <ArrowLeft className="h-5 w-5" />
            Back to inbox
          </Link>

          <EmptyState
            title={appErrorCopy.title}
            description={appErrorCopy.description}
            action={
              <SecondaryButton type="button" size="sm" onClick={reload}>
                Try again
              </SecondaryButton>
            }
          />
        </div>
      );
    }

    return (
      <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-center shadow-sm dark:border-rose-500/20 dark:bg-rose-500/10 sm:p-8">
        <h1 className="text-xl font-bold text-rose-900 dark:text-rose-100">
          We couldn&apos;t load this conversation
        </h1>
        <p className="mt-2 text-sm font-medium text-rose-700 dark:text-rose-200">
          {error?.message || "This conversation is not available right now."}
        </p>
      </div>
    );
  }

  return (
    <ProtectedConversationScreen
      connectionId={conversation.connectionId}
      conversation={conversation}
      routingPersona={routingPersona}
      navigationVariant={variant}
      prefetchedData={{
        connection,
        permissions,
        permissionsExplanation,
      }}
    />
  );
}
