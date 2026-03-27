"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { showToast } from "@/components/shared/toast-viewport";
import {
  optimisticallyTransitionFollowUp,
  reconcileFollowUp,
  refreshFollowUps,
  useAppDataSnapshot,
} from "@/lib/app-data-store";
import { followUpsApi } from "@/lib/api/follow-ups-api";
import { ApiError } from "@/lib/api/client";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { routes } from "@/lib/constants/routes";
import {
  getPassiveReminderBadgeLabel,
  getPassiveReminderBody,
  getPassiveReminderHeadline,
  getPassiveReminderScheduleLabel,
  isPassiveInactivityFollowUp,
} from "@/lib/follow-ups/passive-reminder";
import { formatConnectionContext } from "@/lib/utils/format-contact-relationship";
import { isExpiredSessionError } from "@/lib/utils/auth-errors";
import { cn } from "@/lib/utils/cn";
import type { FollowUp, FollowUpStatus } from "@/types/follow-up";

type PendingUrgencyBucket = "overdue" | "due" | "soon" | "later";

const FOLLOW_UP_EXIT_DURATION_MS = 160;

const FILTERS: Array<{
  key: FollowUpStatus;
  label: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}> = [
  {
    key: "pending",
    label: "Next up",
    description:
      "Keep the next relationship cue close, without letting it feel transactional.",
    emptyTitle: "Nothing to follow up right now",
    emptyDescription: dotlyPositioning.app.noFollowUps,
  },
  {
    key: "completed",
    label: "Done",
    description:
      "A quiet record of the follow-ups you have already closed with care.",
    emptyTitle: "No finished follow-ups yet",
    emptyDescription:
      "Completed follow-ups will gather here once each conversation is gracefully closed.",
  },
  {
    key: "cancelled",
    label: "Dismissed",
    description: "Relationship reminders you chose not to keep in motion.",
    emptyTitle: "No dismissed follow-ups",
    emptyDescription:
      "Dismissed reminders stay tucked away until you want the history.",
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
      return (
        new Date(left.remindAt).getTime() - new Date(right.remindAt).getTime()
      );
    }

    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
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
      return [<StatusBadge key="due" label="Ready now" tone="warning" dot />];
    case "soon":
      return [<StatusBadge key="soon" label="Coming up" tone="info" dot />];
    case "later":
    default:
      return [];
  }
}

function getPendingSections(followUps: FollowUp[]) {
  const pending = sortFollowUps(followUps).filter(
    (followUp) => followUp.status === "pending",
  );
  const passiveReminderCount = pending.filter((followUp) =>
    isPassiveInactivityFollowUp(followUp),
  ).length;

  return [
    {
      key: "overdue",
      title: "Overdue",
      description:
        "Begin with the relationships that have waited the longest for your attention.",
      items: pending.filter(
        (followUp) => getPendingUrgency(followUp) === "overdue",
      ),
    },
    {
      key: "due",
      title: "Ready now",
      description: "These relationships are ready for a gentle touchpoint now.",
      items: pending.filter(
        (followUp) => getPendingUrgency(followUp) === "due",
      ),
    },
    {
      key: "soon",
      title: "Coming up",
      description: "These will come into focus soon.",
      items: pending.filter(
        (followUp) => getPendingUrgency(followUp) === "soon",
      ),
    },
    {
      key: "later",
      title: "Later",
      description: "People worth revisiting later, without pressure.",
      items: pending.filter(
        (followUp) => getPendingUrgency(followUp) === "later",
      ),
    },
  ].filter((section) => section.items.length > 0);
}

function getStatusBadge(status: FollowUpStatus) {
  switch (status) {
    case "pending":
      return <StatusBadge label="Open" tone="warning" dot />;
    case "completed":
      return <StatusBadge label="Done" tone="success" />;
    case "cancelled":
      return <StatusBadge label="Dismissed" tone="neutral" />;
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

function getConnectionContextLine(followUp: FollowUp) {
  const { sourceType } = followUp.relationship;

  if (!sourceType) {
    return null;
  }

  return formatConnectionContext(
    undefined,
    followUp.relationship.sourceLabel,
    sourceType,
  );
}

function getPassiveContactLine(followUp: FollowUp) {
  const title = getFollowUpTitle(followUp);
  const companyLine = getCompanyLine(followUp);

  return companyLine ? `${title} • ${companyLine}` : title;
}

export function FollowUpsScreen() {
  const router = useRouter();
  const { followUps: followUpState } = useAppDataSnapshot();
  const [selectedStatus, setSelectedStatus] =
    useState<FollowUpStatus>("pending");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{
    id: string;
    type: "complete" | "cancel";
  } | null>(null);
  const [exitingIds, setExitingIds] = useState<Record<string, true>>({});
  const statusState = followUpState[selectedStatus];
  const followUps = statusState.data;
  const showSkeleton =
    followUps.length === 0 &&
    (statusState.status === "idle" || statusState.status === "loading");
  const isRefreshing = statusState.status === "loading" && followUps.length > 0;
  const loadError = followUps.length === 0 ? statusState.error : null;

  useEffect(() => {
    void refreshFollowUps(selectedStatus).catch((error) => {
      if (isExpiredSessionError(error)) {
        router.replace(
          `/login?next=${encodeURIComponent(routes.app.followUps)}&reason=expired`,
        );
      }
    });
  }, [router, selectedStatus]);

  const activeFilter =
    FILTERS.find((filter) => filter.key === selectedStatus) ?? FILTERS[0];
  const pendingSections =
    selectedStatus === "pending" ? getPendingSections(followUps) : [];
  const passiveReminderCount = followUps.filter((followUp) =>
    isPassiveInactivityFollowUp(followUp),
  ).length;

  async function handleAction(id: string, type: "complete" | "cancel") {
    setActionState({ id, type });
    setActionError(null);
    setExitingIds((current) => ({ ...current, [id]: true }));

    const request =
      type === "complete" ? followUpsApi.complete(id) : followUpsApi.cancel(id);

    let rollback: (() => void) | null = null;

    try {
      await new Promise((resolve) =>
        window.setTimeout(resolve, FOLLOW_UP_EXIT_DURATION_MS),
      );
      rollback = optimisticallyTransitionFollowUp(
        id,
        type === "complete" ? "completed" : "cancelled",
      );
      const updated = await request;

      reconcileFollowUp(updated);
      showToast(type === "complete" ? "Marked complete" : "Cancelled");
    } catch (error) {
      rollback?.();
      setActionError(
        error instanceof ApiError
          ? error.message
          : `Could not ${type} this follow-up just now.`,
      );
    } finally {
      setExitingIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setActionState(null);
    }
  }

  if (showSkeleton) {
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
        title="Follow-ups are unavailable"
        description={loadError}
        action={
          <PrimaryButton
            type="button"
            fullWidth
            onClick={() =>
              void refreshFollowUps(selectedStatus, { force: true })
            }
          >
            Try again
          </PrimaryButton>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Member care
            </p>
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Relationship rhythm
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => {
              const isActive = filter.key === selectedStatus;

              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setSelectedStatus(filter.key)}
                  className={cn(
                    "min-h-11 rounded-full px-4 text-sm font-semibold transition-colors ring-1",
                    isActive
                      ? "bg-foreground text-background ring-black/10 dark:bg-white dark:text-slate-950 dark:ring-white/10"
                      : "bg-foreground/[0.03] text-foreground ring-black/5 hover:bg-foreground/[0.05] dark:bg-white/[0.045] dark:ring-white/10 dark:hover:bg-white/[0.06]",
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
              {!showSkeleton ? (
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  {followUps.length}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted">{activeFilter.description}</p>
            <div className="min-h-5">
              {isRefreshing ? (
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                  Refreshing quietly...
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {selectedStatus === "pending" && passiveReminderCount >= 6 ? (
        <div className="rounded-2xl bg-foreground/[0.03] px-4 py-3 ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
          <p className="text-sm leading-6 text-foreground/80">
            {passiveReminderCount} gentle reminders are grouped here. Start with
            the first few relationships rather than trying to clear the whole
            list.
          </p>
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-2xl bg-rose-500/5 px-4 py-3 ring-1 ring-inset ring-rose-500/20">
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
            <div
              key={section.key}
              className="space-y-3 rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5"
            >
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

              <div className="overflow-hidden rounded-3xl bg-white/40 backdrop-blur-[40px] saturate-[200%] shadow-sm ring-[0.5px] ring-black/5 dark:bg-black/40 dark:ring-white/10 divide-y divide-black/5 dark:divide-white/5">
                {section.items.map((followUp) => {
                  const isWorking = actionState?.id === followUp.id;
                  const isPassiveReminder =
                    isPassiveInactivityFollowUp(followUp);
                  const title = getFollowUpTitle(followUp);
                  const companyLine = getCompanyLine(followUp);
                  const connectionContextLine =
                    getConnectionContextLine(followUp);
                  const urgencyBadges = getUrgencyBadges(followUp);

                  return (
                    <div
                      key={followUp.id}
                      className={cn(
                        "transition-[opacity,transform] duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                        exitingIds[followUp.id]
                          ? "translate-y-2 opacity-0"
                          : "translate-y-0 opacity-100",
                        "p-5 transition-colors hover:bg-black/[0.02] active:bg-black/5 dark:hover:bg-white/[0.02] dark:active:bg-white/5",
                        isPassiveReminder &&
                          "border-black/5 bg-foreground/[0.04] dark:border-white/10 dark:bg-white/[0.06]",
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
                            {isPassiveReminder ? (
                              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                                {getPassiveReminderBadgeLabel()}
                              </p>
                            ) : null}
                            <Link
                              href={routes.app.contactDetail(
                                followUp.relationshipId,
                              )}
                              className="block text-base font-semibold text-foreground transition-colors hover:opacity-70"
                            >
                              {isPassiveReminder
                                ? getPassiveReminderHeadline()
                                : title}
                            </Link>
                            {isPassiveReminder ? (
                              <p className="text-sm text-muted">
                                {getPassiveContactLine(followUp)}
                              </p>
                            ) : companyLine ? (
                              <p className="text-sm text-muted">
                                {companyLine}
                              </p>
                            ) : null}
                            {connectionContextLine ? (
                              <p className="text-xs text-muted/90">
                                {connectionContextLine}
                              </p>
                            ) : null}
                          </div>
                          <div className="self-start">
                            {getStatusBadge(followUp.status)}
                          </div>
                        </div>

                        {urgencyBadges.length > 0 ? (
                          <div className="flex flex-wrap gap-2 sm:gap-2.5">
                            {urgencyBadges}
                          </div>
                        ) : null}

                        <div
                          className={cn(
                            "rounded-2xl border px-4 py-3",
                            isPassiveReminder
                              ? "bg-foreground/[0.04] ring-1 ring-inset ring-black/5 dark:bg-white/[0.05] dark:ring-white/10"
                              : "bg-foreground/[0.03] ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5",
                          )}
                        >
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                            {isPassiveReminder
                              ? getPassiveReminderScheduleLabel()
                              : "Revisit on"}
                          </p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {formatReminder(followUp.remindAt)}
                          </p>
                          {isPassiveReminder ? (
                            <p className="mt-1 text-sm leading-6 text-foreground/80">
                              {getPassiveReminderBody()}
                            </p>
                          ) : null}
                        </div>

                        {followUp.note ? (
                          <div className="rounded-2xl bg-foreground/[0.03] px-4 py-3 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
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
                            onClick={() =>
                              void handleAction(followUp.id, "complete")
                            }
                          >
                            {isWorking && actionState?.type === "complete"
                              ? "Completing..."
                              : isPassiveReminder
                                ? "Done"
                                : "Mark complete"}
                          </PrimaryButton>
                          {isPassiveReminder ? (
                            <Link
                              href={routes.app.contactDetail(
                                followUp.relationshipId,
                              )}
                              className="inline-flex min-h-[60px] w-full items-center justify-center rounded-2xl bg-foreground/[0.04] px-5 py-4 text-sm font-semibold text-foreground shadow-inner ring-1 ring-black/5 transition-all hover:bg-foreground/[0.06] active:scale-95 dark:bg-white/[0.05] dark:ring-white/10 dark:hover:bg-white/[0.07]"
                            >
                              Plan a follow-up
                            </Link>
                          ) : (
                            <SecondaryButton
                              type="button"
                              fullWidth
                              disabled={isWorking}
                              onClick={() =>
                                void handleAction(followUp.id, "cancel")
                              }
                            >
                              {isWorking && actionState?.type === "cancel"
                                ? "Closing..."
                                : "Dismiss"}
                            </SecondaryButton>
                          )}
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
        <div className="overflow-hidden rounded-3xl bg-white/40 backdrop-blur-[40px] saturate-[200%] shadow-sm ring-[0.5px] ring-black/5 dark:bg-black/40 dark:ring-white/10 divide-y divide-black/5 dark:divide-white/5">
          {followUps.map((followUp) => {
            const isWorking = actionState?.id === followUp.id;
            const isPassiveReminder = isPassiveInactivityFollowUp(followUp);
            const title = getFollowUpTitle(followUp);
            const companyLine = getCompanyLine(followUp);
            const connectionContextLine = getConnectionContextLine(followUp);
            const resolutionLabel = getResolutionLabel(followUp);
            const urgencyBadges = getUrgencyBadges(followUp);

            return (
              <div
                key={followUp.id}
                className={cn(
                  "transition-[opacity,transform] duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                  exitingIds[followUp.id]
                    ? "translate-y-2 opacity-0"
                    : "translate-y-0 opacity-100",
                  "p-5 transition-colors hover:bg-black/[0.02] active:bg-black/5 dark:hover:bg-white/[0.02] dark:active:bg-white/5",
                  isPassiveReminder &&
                    "border-black/5 bg-foreground/[0.04] dark:border-white/10 dark:bg-white/[0.06]",
                  followUp.status !== "pending" ? "opacity-90" : "",
                )}
              >
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      {isPassiveReminder ? (
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                          {getPassiveReminderBadgeLabel()}
                        </p>
                      ) : null}
                      <Link
                        href={routes.app.contactDetail(followUp.relationshipId)}
                        className="block text-base font-semibold text-foreground transition-colors hover:opacity-70"
                      >
                        {isPassiveReminder
                          ? getPassiveReminderHeadline()
                          : title}
                      </Link>
                      {isPassiveReminder ? (
                        <p className="text-sm text-muted">
                          {getPassiveContactLine(followUp)}
                        </p>
                      ) : companyLine ? (
                        <p className="text-sm text-muted">{companyLine}</p>
                      ) : null}
                      {connectionContextLine ? (
                        <p className="text-xs text-muted/90">
                          {connectionContextLine}
                        </p>
                      ) : null}
                    </div>
                    <div className="self-start">
                      {getStatusBadge(followUp.status)}
                    </div>
                  </div>

                  {urgencyBadges.length > 0 ? (
                    <div className="flex flex-wrap gap-2 sm:gap-2.5">
                      {urgencyBadges}
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      "rounded-2xl border px-4 py-3",
                      isPassiveReminder
                        ? "bg-foreground/[0.04] ring-1 ring-inset ring-black/5 dark:bg-white/[0.05] dark:ring-white/10"
                        : "bg-foreground/[0.03] ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5",
                    )}
                  >
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                      {isPassiveReminder
                        ? getPassiveReminderScheduleLabel()
                        : followUp.status === "pending"
                          ? "Revisit on"
                          : "Relationship note"}
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {formatReminder(followUp.remindAt)}
                    </p>
                    {isPassiveReminder ? (
                      <p className="mt-1 text-sm leading-6 text-foreground/80">
                        {getPassiveReminderBody()}
                      </p>
                    ) : null}
                    {resolutionLabel ? (
                      <p className="mt-1 text-xs text-muted">
                        {followUp.status === "completed"
                          ? `Completed ${resolutionLabel}`
                          : `Dismissed ${resolutionLabel}`}
                      </p>
                    ) : null}
                  </div>

                  {followUp.note ? (
                    <div className="rounded-2xl bg-foreground/[0.03] px-4 py-3 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
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
                        onClick={() =>
                          void handleAction(followUp.id, "complete")
                        }
                      >
                        {isWorking && actionState?.type === "complete"
                          ? "Completing..."
                          : isPassiveReminder
                            ? "Done"
                            : "Mark complete"}
                      </PrimaryButton>
                      {isPassiveReminder ? (
                        <Link
                          href={routes.app.contactDetail(
                            followUp.relationshipId,
                          )}
                          className="inline-flex min-h-[60px] w-full items-center justify-center rounded-2xl bg-foreground/[0.04] px-5 py-4 text-sm font-semibold text-foreground shadow-inner ring-1 ring-black/5 transition-all hover:bg-foreground/[0.06] active:scale-95 dark:bg-white/[0.05] dark:ring-white/10 dark:hover:bg-white/[0.07]"
                        >
                          Plan a follow-up
                        </Link>
                      ) : (
                        <SecondaryButton
                          type="button"
                          fullWidth
                          disabled={isWorking}
                          onClick={() =>
                            void handleAction(followUp.id, "cancel")
                          }
                        >
                          {isWorking && actionState?.type === "cancel"
                            ? "Closing..."
                            : "Dismiss"}
                        </SecondaryButton>
                      )}
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
