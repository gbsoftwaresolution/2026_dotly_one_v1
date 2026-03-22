"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export function FollowUpsScreen() {
  const router = useRouter();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{
    id: string;
    type: "complete" | "cancel";
  } | null>(null);

  const loadFollowUps = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await followUpsApi.list();
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
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadFollowUps();
  }, [loadFollowUps]);

  const sections = useMemo(
    () => [
      {
        key: "pending",
        title: "Pending",
        description: "Keep the next important touchpoint in view.",
        items: followUps.filter((followUp) => followUp.status === "pending"),
      },
      {
        key: "completed",
        title: "Completed",
        description: "Recently handled reminders.",
        items: followUps.filter((followUp) => followUp.status === "completed"),
      },
      {
        key: "cancelled",
        title: "Cancelled",
        description: "Reminders you decided not to keep.",
        items: followUps.filter((followUp) => followUp.status === "cancelled"),
      },
    ],
    [followUps],
  );

  async function handleAction(id: string, type: "complete" | "cancel") {
    setActionState({ id, type });
    setActionError(null);

    try {
      const updated =
        type === "complete"
          ? await followUpsApi.complete(id)
          : await followUpsApi.cancel(id);

      setFollowUps((current) =>
        sortFollowUps(
          current.map((followUp) =>
            followUp.id === updated.id ? updated : followUp,
          ),
        ),
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
          <PrimaryButton type="button" fullWidth onClick={() => void loadFollowUps()}>
            Try again
          </PrimaryButton>
        }
      />
    );
  }

  if (followUps.length === 0) {
    return (
      <EmptyState
        title="No follow-ups yet"
        description="Set reminders for the people you want to keep warm with thoughtful, timely check-ins."
      />
    );
  }

  return (
    <div className="space-y-5">
      {actionError ? (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
          <p className="font-sans text-sm text-rose-600 dark:text-rose-400">
            {actionError}
          </p>
        </div>
      ) : null}

      {sections.map((section) => {
        if (section.items.length === 0) {
          return null;
        }

        return (
          <section key={section.key} className="space-y-3">
            <div className="space-y-1 px-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-sans text-lg font-semibold text-foreground">
                  {section.title}
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  {section.items.length}
                </span>
              </div>
              <p className="text-sm text-muted">{section.description}</p>
            </div>

            <div className="space-y-3">
              {section.items.map((followUp) => {
                const isWorking = actionState?.id === followUp.id;
                const companyLine = [
                  followUp.relationship.targetPersona.jobTitle,
                  followUp.relationship.targetPersona.companyName,
                ]
                  .filter(Boolean)
                  .join(" at ");
                const completedLabel =
                  followUp.status === "completed"
                    ? formatMetaTime(followUp.completedAt)
                    : followUp.status === "cancelled"
                      ? formatMetaTime(followUp.updatedAt)
                      : null;

                return (
                  <div
                    key={followUp.id}
                    className={cn(
                      "rounded-card border border-black/[0.06] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_0_rgba(255,255,255,0.9)] dark:border-white/[0.06] dark:bg-surface1 dark:shadow-card",
                      followUp.status !== "pending" ? "opacity-90" : "",
                    )}
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <Link
                            href={routes.app.contactDetail(followUp.relationshipId)}
                            className="block text-base font-semibold text-foreground transition-colors hover:text-brandRose dark:hover:text-brandCyan"
                          >
                            {followUp.relationship.targetPersona.fullName}
                          </Link>
                          {companyLine ? (
                            <p className="text-sm text-muted">{companyLine}</p>
                          ) : null}
                        </div>
                        {getStatusBadge(followUp.status)}
                      </div>

                      <div className="rounded-2xl border border-border bg-surface/60 px-4 py-3">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                          Remind at
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {formatReminder(followUp.remindAt)}
                        </p>
                        {completedLabel ? (
                          <p className="mt-1 text-xs text-muted">
                            {followUp.status === "completed"
                              ? `Completed ${completedLabel}`
                              : `Updated ${completedLabel}`}
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
                        <div className="grid grid-cols-2 gap-2">
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
          </section>
        );
      })}
    </div>
  );
}