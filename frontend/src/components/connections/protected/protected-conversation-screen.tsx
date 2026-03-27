"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeInfo,
  Clock3,
  Send,
  Video,
  FileText,
  Forward,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";

import { ProtectedModeBanner } from "@/components/connections/protected/protected-mode-banner";
import { ProtectedRestrictionsPanel } from "@/components/connections/protected/protected-restrictions-panel";
import { ProtectedActionState } from "@/components/connections/protected/protected-action-state";
import {
  explainResolvedPermissions,
  getConnection,
  getResolvedPermissions,
} from "@/lib/api/connections";
import { routes } from "@/lib/constants/routes";
import { getProtectedRestrictions } from "@/lib/protected-mode";
import type {
  IdentityConnection,
  ResolvedPermissionsMap,
} from "@/types/connection";
import type { IdentityConversationContext } from "@/types/conversation";
import type { ResolvedPermissionsExplanation } from "@/types/permissions";
import type { PersonaSummary } from "@/types/persona";

interface ProtectedConversationScreenProps {
  connectionId: string;
  conversation?: IdentityConversationContext | null;
  routingPersona?: PersonaSummary | null;
  navigationVariant?: "app" | "app-old";
}

function formatConversationTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Recently updated";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Recently updated";
  }
}

function formatEnumLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.replaceAll("_", " ");
}

function getMetadataString(
  metadata: Record<string, unknown> | null,
  keys: string[],
) {
  for (const key of keys) {
    const value = metadata?.[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

export function ProtectedConversationScreen({
  connectionId,
  conversation,
  routingPersona,
  navigationVariant = "app",
}: ProtectedConversationScreenProps) {
  const [connection, setConnection] = useState<IdentityConnection | null>(null);
  const [permissions, setPermissions] = useState<ResolvedPermissionsMap | null>(
    null,
  );
  const [permissionsExplanation, setPermissionsExplanation] =
    useState<ResolvedPermissionsExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cancelled = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const [conn, perms, explanation] = await Promise.all([
          getConnection(connectionId),
          getResolvedPermissions(connectionId),
          explainResolvedPermissions(connectionId),
        ]);

        if (cancelled) return;
        setConnection(conn);
        setPermissions(perms);
        setPermissionsExplanation(explanation);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load conversation.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    },
    [connectionId],
  );

  useEffect(() => {
    let cancelled = false;
    void load(cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-5">
        <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-[72px] w-full bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-[400px] w-full bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error || !connection) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-5">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-12 w-12 text-rose-500 mb-4" />
          <h2 className="text-xl font-bold text-rose-900 mb-2">
            Failed to load environment
          </h2>
          <p className="text-rose-700 mb-6">
            {error || "Connection not found"}
          </p>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const restrictions = getProtectedRestrictions(
    permissions,
    permissionsExplanation,
  );
  const conversationTypeLabel = formatEnumLabel(conversation?.conversationType);
  const conversationStatusLabel = formatEnumLabel(
    conversation?.conversationStatus,
  );
  const routingLabel =
    routingPersona?.routingDisplayName ??
    routingPersona?.fullName ??
    (routingPersona?.username ? `@${routingPersona.username}` : null) ??
    getMetadataString(conversation?.metadataJson ?? null, [
      "personaRoutingDisplayName",
      "routingDisplayName",
      "personaRouteLabel",
      "routeLabel",
    ]) ??
    (conversation?.personaId ? "Persona-routed thread" : null);
  const routingKey =
    routingPersona?.routingKey ??
    getMetadataString(conversation?.metadataJson ?? null, [
      "personaRoutingKey",
      "routingKey",
      "routeKey",
    ]);
  const backLink =
    navigationVariant === "app"
      ? {
          href: routes.app.inbox,
          label: "Back to inbox",
        }
      : {
          href: `/app-old/connections/${connectionId}`,
          label: "Back to profile",
        };

  const getExplanationText = (key: string, fallback: string) => {
    const match = permissionsExplanation?.permissions?.find(
      (permission) => permission.key === key,
    );

    return match?.explanationText || fallback;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-5">
      <Link
        className="inline-flex items-center gap-2 text-base font-semibold text-sky-700 hover:text-sky-800"
        href={backLink.href}
      >
        <ArrowLeft className="h-5 w-5" />
        {backLink.label}
      </Link>

      <ProtectedModeBanner
        permissions={permissions}
        explanation={permissionsExplanation}
      />

      <div className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {conversationTypeLabel ? (
            <span className="rounded-full border border-black/5 bg-black/[0.03] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted dark:border-white/10 dark:bg-white/[0.04]">
              {conversationTypeLabel}
            </span>
          ) : null}
          {conversationStatusLabel ? (
            <span className="rounded-full border border-black/5 bg-black/[0.03] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted dark:border-white/10 dark:bg-white/[0.04]">
              {conversationStatusLabel}
            </span>
          ) : null}
          <span className="rounded-full border border-black/5 bg-black/[0.03] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted dark:border-white/10 dark:bg-white/[0.04]">
            {restrictions.isProtected
              ? "Protected conversation"
              : "Standard conversation"}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[2rem]">
              Chat with {connection.targetIdentity?.displayName || "Unknown"}
            </h1>
            <p className="mt-2 max-w-[48ch] text-sm leading-6 text-muted">
              The thread keeps legacy protected-mode behavior, now with routing
              context surfaced directly in the new app shell.
            </p>
          </div>

          {conversation?.personaId ? (
            <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-left shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10 lg:max-w-[18rem]">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                Persona route
              </p>
              <p className="mt-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {routingLabel || "Persona-routed thread"}
              </p>
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-200">
                {routingKey ? `Routed via #${routingKey}` : "Persona route active"}
              </p>
            </div>
          ) : null}
        </div>

        {conversation ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.25rem] border border-black/5 bg-white/75 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-black/20">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                Thread status
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {conversationStatusLabel || "Active"}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-black/5 bg-white/75 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-black/20">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                Last updated
              </p>
              <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <Clock3 className="h-4 w-4 text-muted" />
                {formatConversationTimestamp(conversation.updatedAt)}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-black/5 bg-white/75 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-black/20">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                Conversation ID
              </p>
              <p className="mt-2 inline-flex items-center gap-2 break-all text-sm font-semibold text-foreground">
                <BadgeInfo className="h-4 w-4 text-muted" />
                {conversation.conversationId}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-8 space-y-4">
          <div className="flex gap-4 rounded-2xl bg-slate-50 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-600">
              {connection.targetIdentity?.displayName?.charAt(0) || "?"}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {connection.targetIdentity?.displayName}
              </p>
              <p className="mt-1 text-slate-700">
                Hi there, here is the secret document you requested.
              </p>
              <div className="mt-3 flex gap-2">
                <ProtectedActionState
                  label="Forward message"
                  effect={restrictions.exports.effect}
                  reasonText={getExplanationText(
                    restrictions.exports.key,
                    "Restricted because protected mode is on.",
                  )}
                >
                  <button className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
                    <Forward className="h-3 w-3" />
                    Forward
                  </button>
                </ProtectedActionState>

                <ProtectedActionState
                  label="Export document"
                  effect={restrictions.exports.effect}
                  reasonText={getExplanationText(
                    restrictions.exports.key,
                    "Unavailable until protected mode changes.",
                  )}
                >
                  <button className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
                    <FileText className="h-3 w-3" />
                    Save Attachment
                  </button>
                </ProtectedActionState>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3 border-t border-slate-100 pt-6">
          <button className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-left text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            Type a message...
          </button>

          <ProtectedActionState
            label="Video Call"
            effect={restrictions.calls.effect}
            reasonText={getExplanationText(
              restrictions.calls.key,
              "Unavailable until protected mode changes.",
            )}
          >
            <button className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200">
              <Video className="h-5 w-5" />
            </button>
          </ProtectedActionState>

          <button className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>

      <ProtectedRestrictionsPanel
        permissions={permissions}
        explanation={permissionsExplanation}
      />
    </div>
  );
}
