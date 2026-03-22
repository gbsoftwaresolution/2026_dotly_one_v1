"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { followUpsApi } from "@/lib/api/follow-ups-api";
import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";
import { isExpiredSessionError } from "@/lib/utils/auth-errors";
import { cn } from "@/lib/utils/cn";
import type { FollowUp, FollowUpStatus } from "@/types/follow-up";

type PendingUrgencyBucket = "overdue" | "due" | "soon" | "later";

const FILTERS: Array<{
  key: FollowUpStatus;
  label: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}> = [
  {
    key: "pending",
    label: "Pending",
    description: "Keep the next conversation cue visible without adding friction.",
    emptyTitle: "No follow-ups scheduled",
    emptyDescription: "Add a reminder when you want a gentle prompt to reconnect.",
  },
  {
    key: "completed",
    label: "Completed",
    description: "A quick record of reminders you already handled.",
    emptyTitle: "No completed follow-ups yet",
    emptyDescription: "Completed reminders will appear here once you close the loop.",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    description: "Reminders you decided not to keep.",
    emptyTitle: "No cancelled follow-ups",
    emptyDescription: "Cancelled reminders will stay out of your way until you need the history.",
  },
];

function formatReminder(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatMetaTime(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getResolutionLabel(followUp: FollowUp) {
  if (followUp.status === "completed") {
    return formatMetaTime(followUp.completedAt);
  }

  if (followUp.status === "cancelled") {
    return formatMetaTime(followUp.updatedAt);
  }

  return null;
}

function sortFollowUps(items: FollowUp[]) {
  return [...items].sort((left, right) => {
    const leftPending = left.status === "pending";
    const rightPending = right.status === "pending";

    if (leftPending && !rightPending) {
      return -1;
    }

    if (!leftPending && rightPending) {
      return 1;
    }

    if (leftPending && rightPending) {
      return new Date(left.remindAt).getTime() - new Date(right.remindAt).getTime();
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function getPendingUrgency(followUp: FollowUp): PendingUrgencyBucket {
  const remindAt = new Date(followUp.remindAt).getTime();
  const now = Date.now();
  const hoursUntilReminder = (remindAt - now) / (1000 * 60 * 60);

  if (followUp.metadata?.isOverdue) {
    return "overdue";
  }

  if (followUp.metadata?.isTriggered) {
    return "due";
  }

  if (followUp.metadata?.isUpcomingSoon) {
    return "soon";
  }

  if (remindAt === now) {
    return "due";
  }

  if (remindAt < now) {
    return "overdue";
  }

  if (hoursUntilReminder <= 24) {
    return "soon";
  }

  return "later";
}

function getUrgencyBadges(followUp: FollowUp) {
  if (followUp.status !== "pending") {
    return [];
  }

  const urgency = getPendingUrgency(followUp);

  switch (urgency) {
    case "overdue":
      return [<StatusBadge key="overdue" label="Overdue" tone="error" dot />];
    case "due":
      return [<StatusBadge key="due" label="Due now" tone="warning" dot />];
    case "soon":
      return [<StatusBadge key="soon" label="Due soon" tone="info" dot />];
    case "later":
    default:
      return [];
  }
}

function getPendingSections(followUps: FollowUp[]) {
  const pending = sortFollowUps(followUps).filter((followUp) => followUp.status === "pending");

  return [
    {
      key: "overdue",
      title: "Overdue",
      description: "Start with the reminders that have slipped past their time.",
      items: pending.filter((followUp) => getPendingUrgency(followUp) === "overdue"),
    },
    {
      key: "due",
      title: "Due now",
      description: "Freshly surfaced reminders that are ready for a quick follow-up.",
      items: pending.filter((followUp) => getPendingUrgency(followUp) === "due"),
    },
    {
      key: "soon",
      title: "Due soon",
      description: "Upcoming reminders that are getting close.",
      items: pending.filter((followUp) => getPendingUrgency(followUp) === "soon"),
    },
    {
      key: "later",
      title: "Later",
      description: "Everything else scheduled for a future touchpoint.",
      items: pending.filter((followUp) => getPendingUrgency(followUp) === "later"),
    },
  ].filter((section) => section.items.length > 0);
}

function getStatusBadge(status: FollowUpStatus) {
  switch (status) {
    case "pending":
      return <StatusBadge label="Pending" tone="warning" dot />;
    case "completed":
      return <StatusBadge label="Completed" tone="success" />;
    case "cancelled":
      return <StatusBadge label="Cancelled" tone="neutral" />;
  }
}

function getFollowUpTitle(followUp: FollowUp) {
  return followUp.relationship.targetPersona?.fullName ?? "Contact unavailable";
}

function getCompanyLine(followUp: FollowUp) {
  return [
    followUp.relationship.targetPersona?.jobTitle,
    followUp.relationship.targetPersona?.companyName,
  ]
    .filter(Boolean)
    .join(" at ");
}

export function FollowUpsScreen() {
  const router = useRouter();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<FollowUpStatus>("pending");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{
    id: string;
    type: "complete" | "cancel";
  } | null>(null);
  const requestIdRef = useRef(0);

  const loadFollowUps = useCallback(async (status: FollowUpStatus) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setLoadError(null);

    try {
      if (status === "pending") {
        await followUpsApi.processDue().catch(() => undefined);
      }

      const result = await followUpsApi.list({ status });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setFollowUps(sortFollowUps(result));
    } catch (error) {
      if (isExpiredSessionError(error)) {
        router.replace(
          `/login?next=${encodeURIComponent(routes.app.followUps)}&reason=expired`,
        );
        router.refresh();
        return;
      }

      setLoadError(
        error instanceof ApiError
          ? error.message
          : "We could not load your follow-ups right now.",
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [router]);

  useEffect(() => {
    void loadFollowUps(selectedStatus);
  }, [loadFollowUps, selectedStatus]);

  useEffect(() => {
    if (!actionNotice) {
      return;
    }

    const timer = window.setTimeout(() => setActionNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  const activeFilter = FILTERS.find((filter) => filter.key === selectedStatus) ?? FILTERS[0];
  const pendingSections = selectedStatus === "pending" ? getPendingSections(followUps) : [];

  async function handleAction(id: string, type: "complete" | "cancel") {
    setActionState({ id, type });
    setActionError(null);
    setActionNotice(null);

    try {
      const updated =
        type === "complete"
          ? await followUpsApi.complete(id)
          : await followUpsApi.cancel(id);

      setFollowUps((current) => {
        const remaining = current.filter((followUp) => followUp.id !== updated.id);

        if (updated.status !== selectedStatus) {
          return remaining;
        }

        return sortFollowUps([...remaining, updated]);
      });
      setActionNotice(
        type === "complete" ? "Reminder completed." : "Reminder cancelled.",
      );
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : `Could not ${type} this follow-up right now.`,
      );
    } finally {
      setActionState(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState
        title="Follow-ups unavailable"
        description={loadError}
        action={
          <PrimaryButton
            type="button"
            fullWidth
            onClick={() => void loadFollowUps(selectedStatus)}
          >
            Try again
          </PrimaryButton>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const isActive = filter.key === selectedStatus;

          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setSelectedStatus(filter.key)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
                isActive
                  ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
                  : "border-border bg-surface/70 text-foreground hover:border-black/10 hover:bg-white dark:hover:border-white/15 dark:hover:bg-white/[0.08]",
              )}
              aria-pressed={isActive}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-1 px-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-sans text-lg font-semibold text-foreground">
            {activeFilter.label}
          </h2>
          {!isLoading ? (
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
              {followUps.length}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted">{activeFilter.description}</p>
      </div>

      {actionNotice ? (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
          <p className="font-sans text-sm text-emerald-700 dark:text-emerald-300">
            {actionNotice}
          </p>
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
          <p className="font-sans text-sm text-rose-600 dark:text-rose-400">
            {actionError}
          </p>
        </div>
      ) : null}

      {followUps.length === 0 ? (
        <EmptyState
          title={activeFilter.emptyTitle}
          description={activeFilter.emptyDescription}
        />
      ) : selectedStatus === "pending" ? (
        <div className="space-y-5">
          {pendingSections.map((section) => (
            <div key={section.key} className="space-y-3">
              <div className="space-y-1 px-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-sans text-base font-semibold text-foreground">
                    {section.title}
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    {section.items.length}
                  </span>
                </div>
                <p className="text-sm text-muted">{section.description}</p>
              </div>

              <div className="space-y-3">
                {section.items.map((followUp) => {
                  const isWorking = actionState?.id === followUp.id;
                  const title = getFollowUpTitle(followUp);
                  const companyLine = getCompanyLine(followUp);
                  const urgencyBadges = getUrgencyBadges(followUp);

                  return (
                    <div
                      key={followUp.id}
                      className={cn(
                        "rounded-card border border-black/[0.06] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_0_rgba(255,255,255,0.9)] dark:border-white/[0.06] dark:bg-surface1 dark:shadow-card sm:p-5",
                        section.key === "overdue"
                          ? "border-rose-200/80 dark:border-rose-900/60"
                          : section.key === "due"
                            ? "border-amber-200/80 dark:border-amber-900/60"
                            : "",
                      )}
                    >
                      <div className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <Link
                              href={routes.app.contactDetail(followUp.relationshipId)}
                              className="block text-base font-semibold text-foreground transition-colors hover:text-brandRose dark:hover:text-brandCyan"
                            >
                              {title}
                            </Link>
                            {companyLine ? (
                              <p className="text-sm text-muted">{companyLine}</p>
                            ) : null}
                          </div>
                          <div className="self-start">{getStatusBadge(followUp.status)}</div>
                        </div>

                        {urgencyBadges.length > 0 ? (
                          <div className="flex flex-wrap gap-2 sm:gap-2.5">{urgencyBadges}</div>
                        ) : null}

                        <div className="rounded-2xl border border-border bg-surface/60 px-4 py-3">
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                            Remind at
                          </p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {formatReminder(followUp.remindAt)}
                          </p>
                        </div>

                        {followUp.note ? (
                          <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                              Note
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                              {followUp.note}
                            </p>
                          </div>
                        ) : null}

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <PrimaryButton
                            type="button"
                            fullWidth
                            disabled={isWorking}
                            onClick={() => void handleAction(followUp.id, "complete")}
                          >
                            {isWorking && actionState?.type === "complete"
                              ? "Completing..."
                              : "Complete"}
                          </PrimaryButton>
                          <SecondaryButton
                            type="button"
                            fullWidth
                            disabled={isWorking}
                            onClick={() => void handleAction(followUp.id, "cancel")}
                          >
                            {isWorking && actionState?.type === "cancel"
                              ? "Cancelling..."
                              : "Cancel"}
                          </SecondaryButton>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {followUps.map((followUp) => {
            const isWorking = actionState?.id === followUp.id;
            const title = getFollowUpTitle(followUp);
            const companyLine = getCompanyLine(followUp);
            const resolutionLabel = getResolutionLabel(followUp);
            const urgencyBadges = getUrgencyBadges(followUp);

            return (
              <div
                key={followUp.id}
                className={cn(
                  "rounded-card border border-black/[0.06] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_0_rgba(255,255,255,0.9)] dark:border-white/[0.06] dark:bg-surface1 dark:shadow-card sm:p-5",
                  followUp.status !== "pending" ? "opacity-90" : "",
                )}
              >
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <Link
                        href={routes.app.contactDetail(followUp.relationshipId)}
                        className="block text-base font-semibold text-foreground transition-colors hover:text-brandRose dark:hover:text-brandCyan"
                      >
                        {title}
                      </Link>
                      {companyLine ? (
                        <p className="text-sm text-muted">{companyLine}</p>
                      ) : null}
                    </div>
                    <div className="self-start">{getStatusBadge(followUp.status)}</div>
                  </div>

                  {urgencyBadges.length > 0 ? (
                    <div className="flex flex-wrap gap-2 sm:gap-2.5">{urgencyBadges}</div>
                  ) : null}

                  <div className="rounded-2xl border border-border bg-surface/60 px-4 py-3">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                      {followUp.status === "pending" ? "Remind at" : "Reminder"}
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {formatReminder(followUp.remindAt)}
                    </p>
                    {resolutionLabel ? (
                      <p className="mt-1 text-xs text-muted">
                        {followUp.status === "completed"
                          ? `Completed ${resolutionLabel}`
                          : `Cancelled ${resolutionLabel}`}
                      </p>
                    ) : null}
                  </div>

                  {followUp.note ? (
                    <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                        Note
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                        {followUp.note}
                      </p>
                    </div>
                  ) : null}

                  {followUp.status === "pending" ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <PrimaryButton
                        type="button"
                        fullWidth
                        disabled={isWorking}
                        onClick={() => void handleAction(followUp.id, "complete")}
                      >
                        {isWorking && actionState?.type === "complete"
                          ? "Completing..."
                          : "Complete"}
                      </PrimaryButton>
                      <SecondaryButton
                        type="button"
                        fullWidth
                        disabled={isWorking}
                        onClick={() => void handleAction(followUp.id, "cancel")}
                      >
                        {isWorking && actionState?.type === "cancel"
                          ? "Cancelling..."
                          : "Cancel"}
                      </SecondaryButton>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}