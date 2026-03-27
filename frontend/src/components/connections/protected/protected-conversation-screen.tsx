"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeInfo,
  Clock3,
  MessagesSquare,
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
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  explainResolvedPermissions,
  getConnection,
  getResolvedPermissions,
} from "@/lib/api/connections";
import { routes } from "@/lib/constants/routes";
import {
  getInternalRouteHeadline,
  getInternalRouteLabel,
  getInternalRouteSummary,
} from "@/lib/persona/routing-ux";
import { getProtectedRestrictions } from "@/lib/protected-mode";
import type {
  IdentityConnection,
  PermissionEffect,
  ResolvedPermissionsMap,
} from "@/types/connection";
import type { IdentityConversationContext } from "@/types/conversation";
import type { ResolvedPermissionsExplanation } from "@/types/permissions";
import type { PersonaSummary } from "@/types/persona";

interface ProtectedConversationScreenProps {
  connectionId: string;
  conversation?: IdentityConversationContext | null;
  routingPersona?: PersonaSummary | null;
  navigationVariant?: "app";
  prefetchedData?: {
    connection: IdentityConnection;
    permissions: ResolvedPermissionsMap | null;
    permissionsExplanation: ResolvedPermissionsExplanation | null;
  };
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

  return value
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
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

function formatHashPreview(value: string | null | undefined) {
  if (!value) {
    return "Not captured";
  }

  return value.length > 16
    ? `${value.slice(0, 8)}...${value.slice(-6)}`
    : value;
}

function buildInboxHref(input?: {
  personaFilter?: string | null;
  statusFilter?: string | null;
}) {
  const params = new URLSearchParams();

  if (input?.personaFilter) {
    params.set("persona", input.personaFilter);
  }

  if (input?.statusFilter) {
    params.set("status", input.statusFilter);
  }

  const query = params.toString();

  return query ? `${routes.app.inbox}?${query}` : routes.app.inbox;
}

export function ProtectedConversationScreen({
  connectionId,
  conversation,
  routingPersona,
  navigationVariant = "app",
  prefetchedData,
}: ProtectedConversationScreenProps) {
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState<IdentityConnection | null>(
    prefetchedData?.connection ?? null,
  );
  const [permissions, setPermissions] = useState<ResolvedPermissionsMap | null>(
    prefetchedData?.permissions ?? null,
  );
  const [permissionsExplanation, setPermissionsExplanation] =
    useState<ResolvedPermissionsExplanation | null>(
      prefetchedData?.permissionsExplanation ?? null,
    );
  const [isLoading, setIsLoading] = useState(!prefetchedData);
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
          err instanceof Error
            ? err.message
            : "We couldn't load this conversation.",
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
    if (prefetchedData) {
      setConnection(prefetchedData.connection);
      setPermissions(prefetchedData.permissions);
      setPermissionsExplanation(prefetchedData.permissionsExplanation);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    void load(cancelled);
    return () => {
      cancelled = true;
    };
  }, [load, prefetchedData]);

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
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm transition-shadow duration-200">
          <ShieldAlert className="mx-auto h-12 w-12 text-rose-500 mb-4" />
          <h2 className="text-xl font-bold text-rose-900 mb-2">
            Unable to open this conversation
          </h2>
          <p className="text-rose-700 mb-6">
            {error || "This conversation is not available right now."}
          </p>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-[24px] bg-rose-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
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
  const connectionTypeLabel = formatEnumLabel(connection.connectionType);
  const trustStateLabel = formatEnumLabel(connection.trustState);
  const routingLabel =
    (routingPersona ? getInternalRouteHeadline(routingPersona) : null) ??
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
  const routingSummary = routingPersona
    ? getInternalRouteSummary(routingPersona)
    : conversation?.personaId
      ? "This conversation is organized through the route attached to it."
      : "This conversation stays in your main inbox.";
  const routingLabelText = routingPersona
    ? getInternalRouteLabel(routingPersona).replace(/^Internal route/, "Route")
    : routingKey
      ? `Route #${routingKey}`
      : conversation?.personaId
        ? "Persona route"
        : "Identity inbox";
  const inboxPersonaFilter =
    searchParams.get("persona") ?? conversation?.personaId ?? null;
  const inboxStatusFilter =
    searchParams.get("status") ??
    (conversation?.conversationStatus === "ARCHIVED"
      ? conversation.conversationStatus
      : null);
  const inboxViewLabel =
    inboxStatusFilter === "ARCHIVED"
      ? "Archived lane"
      : inboxStatusFilter === "ACTIVE"
        ? "Active queue"
        : "Inbox";
  const inboxRouteLabel =
    inboxPersonaFilter === "identity-default"
      ? "Identity inbox"
      : routingPersona?.username
        ? `@${routingPersona.username}`
        : inboxPersonaFilter
          ? "Persona route"
          : "All routes";
  const backLink = {
    href: buildInboxHref({
      personaFilter: inboxPersonaFilter,
      statusFilter: inboxStatusFilter,
    }),
    label:
      inboxStatusFilter === "ARCHIVED"
        ? "Back to archived inbox"
        : "Back to inbox",
  };

  const getExplanationText = (key: string, fallback: string) => {
    const match = permissionsExplanation?.permissions?.find(
      (permission) => permission.key === key,
    );

    return match?.explanationText || fallback;
  };

  const statusTone = (effect: PermissionEffect) => {
    if (effect === "allow") {
      return "success" as const;
    }

    if (effect === "deny") {
      return "error" as const;
    }

    return "warning" as const;
  };

  if (navigationVariant === "app") {
    return (
      <div className="space-y-5">
        <Link
          className="inline-flex items-center gap-2 text-base font-semibold text-sky-700 transition-colors hover:text-sky-800"
          href={backLink.href}
        >
          <ArrowLeft className="h-5 w-5" />
          {backLink.label}
        </Link>

        <PageHeader
          title={
            conversation?.title ||
            `Conversation with ${connection.targetIdentity?.displayName || "Unknown"}`
          }
          description="See who this conversation is with, how it is routed, and which actions are currently available without leaving your inbox flow."
        />

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl transition-shadow duration-200 dark:border-white/10 dark:bg-white/[0.02] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black/[0.04] ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
                <MessagesSquare
                  className="h-5 w-5 text-foreground"
                  strokeWidth={2}
                />
              </div>

              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {conversationTypeLabel ? (
                    <StatusBadge label={conversationTypeLabel} tone="neutral" />
                  ) : null}
                  {conversationStatusLabel ? (
                    <StatusBadge
                      label={conversationStatusLabel}
                      tone={
                        conversation?.conversationStatus === "ACTIVE"
                          ? "success"
                          : conversation?.conversationStatus === "ARCHIVED"
                            ? "neutral"
                            : "warning"
                      }
                      dot={conversation?.conversationStatus === "ACTIVE"}
                    />
                  ) : null}
                  <StatusBadge
                    label={restrictions.isProtected ? "Protected" : "Standard"}
                    tone={restrictions.isProtected ? "cyan" : "neutral"}
                  />
                </div>

                <div>
                  <h2 className="text-[26px] font-bold tracking-tighter text-foreground">
                    {connection.targetIdentity?.displayName ||
                      "Unknown contact"}
                  </h2>
                  <p className="mt-2 max-w-[54ch] text-[15px] font-medium leading-relaxed text-muted">
                    Access stays private and intentional, so only the people
                    assigned to this conversation can view it.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge label={inboxViewLabel} tone="neutral" />
                    <StatusBadge label={inboxRouteLabel} tone="cyan" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.15rem] border border-black/5 bg-white/70 px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-black/20">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                  Last updated
                </p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock3 className="h-4 w-4 text-muted" />
                  {formatConversationTimestamp(conversation?.updatedAt)}
                </p>
              </div>

              <div className="rounded-[1.15rem] border border-black/5 bg-white/70 px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-black/20">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                  Connection type
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {connectionTypeLabel || "Unknown"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {trustStateLabel || "Trust state unavailable"}
                </p>
              </div>

              <div className="rounded-[1.15rem] border border-black/5 bg-white/70 px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-black/20">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                  Conversation ID
                </p>
                <p className="mt-2 inline-flex items-center gap-2 break-all text-sm font-semibold text-foreground">
                  <BadgeInfo className="h-4 w-4 text-muted" />
                  {conversation?.conversationId}
                </p>
              </div>

              <div className="rounded-[1.15rem] border border-black/5 bg-white/70 px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-black/20">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                  Participant
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {connection.targetIdentity?.handle
                    ? `@${connection.targetIdentity.handle}`
                    : connection.targetIdentity?.displayName || "Unknown"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {formatEnumLabel(connection.targetIdentity?.identityType) ||
                    "Identity"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 backdrop-blur-2xl transition-shadow duration-200 dark:border-white/10 dark:bg-white/[0.02] sm:p-6">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
                {conversation?.personaId ? "Persona route" : "Routing"}
              </p>
              <h2 className="mt-3 text-[22px] font-bold tracking-tighter text-foreground">
                {conversation?.personaId
                  ? routingLabel || "Persona-routed thread"
                  : "Identity default thread"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {routingSummary}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge label={routingLabelText} tone="cyan" />
                <StatusBadge label={inboxViewLabel} tone="neutral" />
                {routingPersona?.username ? (
                  <StatusBadge
                    label={`@${routingPersona.username}`}
                    tone="neutral"
                  />
                ) : null}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 backdrop-blur-2xl transition-shadow duration-200 dark:border-white/10 dark:bg-white/[0.02] sm:p-6">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
                Access
              </p>
              <h2 className="mt-3 text-[22px] font-bold tracking-tighter text-foreground">
                Privately scoped
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Owners keep full access. Everyone else sees this conversation
                only when their assignment or participation allows it.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge label="Assignment-aware view" tone="neutral" />
                <StatusBadge
                  label={
                    restrictions.isProtected
                      ? "Protected actions on"
                      : "Standard actions on"
                  }
                  tone={restrictions.isProtected ? "cyan" : "success"}
                />
              </div>
            </div>
          </div>
        </section>

        <ProtectedModeBanner
          permissions={permissions}
          explanation={permissionsExplanation}
        />

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Conversation view
              </p>
              <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                A clear view of this conversation
              </h2>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-black/5 bg-white/70 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-black/20 rounded-[20px] transition-all duration-300 hover:bg-white/40 dark:hover:bg-zinc-800/40">
              <div className="rounded-[1.25rem] border border-dashed border-black/10 bg-black/[0.025] px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black/[0.04] ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
                    <MessagesSquare
                      className="h-4 w-4 text-foreground"
                      strokeWidth={2}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      Conversation details
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      Live messages are not available in this view yet. To keep
                      things accurate, Dotly shows the current route, access
                      protections, and action availability instead.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1rem] border border-black/5 bg-white/75 px-3 py-3 dark:border-white/10 dark:bg-black/20">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                      Created
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {formatConversationTimestamp(conversation?.createdAt)}
                    </p>
                  </div>

                  <div className="rounded-[1rem] border border-black/5 bg-white/75 px-3 py-3 dark:border-white/10 dark:bg-black/20">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                      Last access review
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {formatConversationTimestamp(
                        conversation?.lastResolvedAt,
                      )}
                    </p>
                  </div>

                  <div className="rounded-[1rem] border border-black/5 bg-white/75 px-3 py-3 dark:border-white/10 dark:bg-black/20">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                      Protection reference
                    </p>
                    <p className="mt-2 break-all text-sm font-semibold text-foreground">
                      {formatHashPreview(conversation?.lastPermissionHash)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ProtectedActionState
                  label="Forward message"
                  effect={restrictions.exports.effect}
                  reasonText={getExplanationText(
                    restrictions.exports.key,
                    "Restricted because protected mode is on.",
                  )}
                >
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:bg-white/[0.06] dark:text-white/80 dark:ring-white/10 dark:hover:bg-white/[0.1]">
                    <Forward className="h-4 w-4" />
                    Forward message
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
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:bg-white/[0.06] dark:text-white/80 dark:ring-white/10 dark:hover:bg-white/[0.1]">
                    <FileText className="h-4 w-4" />
                    Export document
                  </button>
                </ProtectedActionState>

                <ProtectedActionState
                  label="Video Call"
                  effect={restrictions.calls.effect}
                  reasonText={getExplanationText(
                    restrictions.calls.key,
                    "Unavailable until protected mode changes.",
                  )}
                >
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:bg-white/[0.06] dark:text-white/80 dark:ring-white/10 dark:hover:bg-white/[0.1]">
                    <Video className="h-4 w-4" />
                    Start video call
                  </button>
                </ProtectedActionState>

                <ProtectedActionState
                  label="AI summary"
                  effect={restrictions.ai.effect}
                  reasonText={getExplanationText(
                    restrictions.ai.key,
                    "AI actions follow the current protection settings for this conversation.",
                  )}
                >
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:bg-white/[0.06] dark:text-white/80 dark:ring-white/10 dark:hover:bg-white/[0.1]">
                    <BadgeInfo className="h-4 w-4" />
                    Create summary
                  </button>
                </ProtectedActionState>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 backdrop-blur-2xl transition-shadow duration-200 dark:border-white/10 dark:bg-white/[0.02] sm:p-6">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
                Protection status
              </p>
              <h2 className="mt-3 text-[22px] font-bold tracking-tighter text-foreground">
                Available actions at a glance
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge
                  label={`Sharing ${restrictions.sharing.label}`}
                  tone={statusTone(restrictions.sharing.effect)}
                />
                <StatusBadge
                  label={`Exports ${restrictions.exports.label}`}
                  tone={statusTone(restrictions.exports.effect)}
                />
                <StatusBadge
                  label={`Calls ${restrictions.calls.label}`}
                  tone={statusTone(restrictions.calls.effect)}
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">
                {permissionsExplanation?.summaryText ||
                  "These protections reflect the latest access and sharing rules for this conversation."}
              </p>
            </div>

            <ProtectedRestrictionsPanel
              permissions={permissions}
              explanation={permissionsExplanation}
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-5">
      <Link
        className="inline-flex items-center gap-2 text-base font-semibold text-sky-700 transition-colors hover:text-sky-800"
        href={backLink.href}
      >
        <ArrowLeft className="h-5 w-5" />
        {backLink.label}
      </Link>

      <ProtectedModeBanner
        permissions={permissions}
        explanation={permissionsExplanation}
      />

      <div className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl transition-shadow duration-200 dark:border-white/10 dark:bg-white/[0.02] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] sm:p-6">
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
            <h1 className="text-2xl font-bold tracking-tight tracking-tight tracking-tight text-foreground sm:text-[2rem]">
              Conversation with{" "}
              {connection.targetIdentity?.displayName || "Unknown"}
            </h1>
            <p className="mt-2 max-w-[48ch] text-sm leading-6 text-muted">
              The same privacy protections stay in place here, with routing and
              access details brought into view.
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
                {routingKey
                  ? `Route key #${routingKey}`
                  : "Persona route active"}
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
                Live message preview is not available in this view.
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
                  <button className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 rounded-[32px] bg-white/60 backdrop-blur-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 transition-all duration-500 hover:-translate-y-1">
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
                  <button className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 rounded-[32px] bg-white/60 backdrop-blur-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 transition-all duration-500 hover:-translate-y-1">
                    <FileText className="h-3 w-3" />
                    Save copy
                  </button>
                </ProtectedActionState>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3 border-t border-slate-100 pt-6">
          <button className="flex-1 rounded-[24px] bg-slate-100 px-4 py-3 text-left text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            Message composer unavailable in this preview
          </button>

          <ProtectedActionState
            label="Video Call"
            effect={restrictions.calls.effect}
            reasonText={getExplanationText(
              restrictions.calls.key,
              "Unavailable until protected mode changes.",
            )}
          >
            <button className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-slate-100 text-slate-600 hover:bg-slate-200">
              <Video className="h-5 w-5" />
            </button>
          </ProtectedActionState>

          <button className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-indigo-600 text-white hover:bg-indigo-700">
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
