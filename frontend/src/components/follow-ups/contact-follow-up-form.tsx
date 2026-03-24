"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { showToast } from "@/components/shared/toast-viewport";
import {
  optimisticallyInsertFollowUp,
  reconcileFollowUp,
} from "@/lib/app-data-store";
import { followUpsApi } from "@/lib/api/follow-ups-api";
import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";
import {
  getPassiveReminderBadgeLabel,
  getPassiveReminderBody,
  getPassiveReminderHeadline,
} from "@/lib/follow-ups/passive-reminder";
import { cn } from "@/lib/utils/cn";
import type {
  CreateFollowUpResponse,
  FollowUp,
  FollowUpPreset,
} from "@/types/follow-up";
import type { ContactFollowUpSummary } from "@/types/contact";

const DAY_MS = 24 * 60 * 60 * 1000;

const QUICK_PRESETS: Array<{
  label: string;
  preset: FollowUpPreset;
}> = [
  { label: "Tomorrow", preset: "TOMORROW" },
  { label: "Next Week", preset: "NEXT_WEEK" },
  { label: "1 Month", preset: "ONE_MONTH" },
];

interface ContactFollowUpFormProps {
  relationshipId: string;
  contactName: string;
  initialFollowUpSummary?: ContactFollowUpSummary | null;
  disabled?: boolean;
}

function formatDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getTomorrowDateInputValue() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  return formatDateInputValue(tomorrow);
}

function formatDateTimeInputValue(date: Date) {
  return `${formatDateInputValue(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getDefaultCustomDateTimeValue() {
  const tomorrowMorning = new Date();
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);

  return formatDateTimeInputValue(tomorrowMorning);
}

function getMinimumCustomDateTimeValue() {
  const minimum = new Date();
  minimum.setSeconds(0, 0);
  minimum.setMinutes(minimum.getMinutes() + 5);

  return formatDateTimeInputValue(minimum);
}

function toCustomDateIsoString(value: string) {
  const combined = new Date(value);

  if (Number.isNaN(combined.getTime())) {
    return null;
  }

  return combined.toISOString();
}

function formatReminder(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatReminderCount(count: number) {
  return count === 1 ? "1 reminder in view" : `${count} reminders in view`;
}

function startOfDay(value: Date) {
  const nextValue = new Date(value);
  nextValue.setHours(0, 0, 0, 0);
  return nextValue;
}

function getDayDifference(remindAt: string) {
  const targetDate = new Date(remindAt);

  if (Number.isNaN(targetDate.getTime())) {
    return null;
  }

  const today = startOfDay(new Date()).getTime();
  const target = startOfDay(targetDate).getTime();
  return Math.round((target - today) / DAY_MS);
}

function formatFollowUpLabel(remindAt: string) {
  const dayDifference = getDayDifference(remindAt);

  if (dayDifference === null) {
    return "soon";
  }

  if (dayDifference <= 0) {
    return dayDifference === 0 ? "today" : "now";
  }

  if (dayDifference === 1) {
    return "tomorrow";
  }

  if (dayDifference === 30) {
    return "in 1 month";
  }

  return `in ${dayDifference} days`;
}

function getFollowUpSummaryState(summary: ContactFollowUpSummary | null) {
  if (!summary?.hasPendingFollowUp || !summary.nextFollowUpAt) {
    return null;
  }

  if (summary.hasPassiveInactivityFollowUp) {
    return {
      eyebrow: getPassiveReminderBadgeLabel(),
      title: getPassiveReminderHeadline(),
      detail: getPassiveReminderBody(),
      tone: "cyan" as const,
    };
  }

  if (summary.isOverdue) {
    return {
      eyebrow: "Pick this back up",
      title: "This conversation is waiting on you.",
      detail: formatReminderCount(summary.pendingFollowUpCount),
      tone: "error" as const,
    };
  }

  if (summary.isTriggered) {
    return {
      eyebrow: "Ready now",
      title: "This is ready for a quick follow-up.",
      detail: formatReminderCount(summary.pendingFollowUpCount),
      tone: "warning" as const,
    };
  }

  return {
    eyebrow: "Next touchpoint",
    title: "Keep the next conversation in view.",
    detail: formatReminderCount(summary.pendingFollowUpCount),
    tone: null,
  };
}

function buildFollowUpSummaryFlags(remindAt: string, isTriggered: boolean) {
  const remindAtMs = new Date(remindAt).getTime();
  const nowMs = Date.now();

  return {
    isTriggered,
    isOverdue: !isTriggered && remindAtMs < nowMs,
    isUpcomingSoon:
      !isTriggered &&
      remindAtMs >= nowMs &&
      remindAtMs <= nowMs + 24 * 60 * 60 * 1000,
  };
}

function mergeFollowUpSummary(
  current: ContactFollowUpSummary | null,
  remindAt: string,
): ContactFollowUpSummary {
  const nextFollowUpAt =
    current?.nextFollowUpAt &&
    new Date(current.nextFollowUpAt).getTime() <= new Date(remindAt).getTime()
      ? current.nextFollowUpAt
      : remindAt;
  const preservesCurrentUrgency = current?.nextFollowUpAt === nextFollowUpAt;
  const flags = buildFollowUpSummaryFlags(
    nextFollowUpAt,
    preservesCurrentUrgency ? (current?.isTriggered ?? false) : false,
  );

  return {
    hasPendingFollowUp: true,
    nextFollowUpAt,
    pendingFollowUpCount: (current?.pendingFollowUpCount ?? 0) + 1,
    hasPassiveInactivityFollowUp:
      preservesCurrentUrgency &&
      Boolean(current?.hasPassiveInactivityFollowUp),
    ...flags,
  };
}

function reconcileCreatedFollowUpSummary(
  current: ContactFollowUpSummary | null,
  optimisticRemindAt: string,
  actualRemindAt: string,
): ContactFollowUpSummary {
  if (!current?.hasPendingFollowUp) {
    return mergeFollowUpSummary(current, actualRemindAt);
  }

  const nextFollowUpAt =
    current.nextFollowUpAt === optimisticRemindAt
      ? actualRemindAt
      : current.nextFollowUpAt &&
          new Date(current.nextFollowUpAt).getTime() <=
            new Date(actualRemindAt).getTime()
        ? current.nextFollowUpAt
        : actualRemindAt;
  const preservesCurrentUrgency = current.nextFollowUpAt === nextFollowUpAt;
  const flags = buildFollowUpSummaryFlags(
    nextFollowUpAt,
    preservesCurrentUrgency ? (current.isTriggered ?? false) : false,
  );

  return {
    hasPendingFollowUp: true,
    nextFollowUpAt,
    pendingFollowUpCount: current.pendingFollowUpCount,
    hasPassiveInactivityFollowUp:
      preservesCurrentUrgency &&
      Boolean(current.hasPassiveInactivityFollowUp),
    ...flags,
  };
}

export function ContactFollowUpForm({
  relationshipId,
  contactName,
  initialFollowUpSummary = null,
  disabled = false,
}: ContactFollowUpFormProps) {
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const [customDate, setCustomDate] = useState(getDefaultCustomDateTimeValue);
  const [isSaving, setIsSaving] = useState(false);
  const [activePreset, setActivePreset] = useState<FollowUpPreset | "CUSTOM" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [followUpSummary, setFollowUpSummary] =
    useState<ContactFollowUpSummary | null>(initialFollowUpSummary);

  const hasPendingReminder =
    followUpSummary?.hasPendingFollowUp && followUpSummary.nextFollowUpAt;
  const followUpSummaryState = getFollowUpSummaryState(followUpSummary);

  function resetComposer() {
    setCustomDate(getDefaultCustomDateTimeValue());
    setIsCustomDateOpen(false);
    setError(null);
  }

  function buildOptimisticFollowUp(remindAt: string): FollowUp {
    const optimisticTimestamp = new Date().toISOString();

    return {
      id: `optimistic-follow-up-${relationshipId}-${Date.now()}`,
      relationshipId,
      remindAt,
      status: "pending",
      isSystemGenerated: false,
      type: "manual",
      note: null,
      createdAt: optimisticTimestamp,
      updatedAt: optimisticTimestamp,
      completedAt: null,
      relationship: {
        relationshipId,
        state: null,
        sourceType: undefined,
        sourceLabel: null,
        targetPersona: {
          id: "",
          username: "",
          fullName: contactName,
          jobTitle: "",
          companyName: "",
          profilePhotoUrl: null,
        },
      },
      metadata: {
        isTriggered: false,
        isOverdue: false,
        isUpcomingSoon: false,
      },
    };
  }

  function mergeCreatedFollowUp(
    createdFollowUp: CreateFollowUpResponse,
    optimisticFollowUp: FollowUp,
  ): FollowUp {
    return {
      ...optimisticFollowUp,
      id: createdFollowUp.id,
      relationshipId: createdFollowUp.relationshipId,
      remindAt: createdFollowUp.remindAt,
      status: createdFollowUp.status,
    };
  }

  async function createFollowUp(payload: {
    remindAt: string;
    preset?: FollowUpPreset;
    customDate?: string;
  }) {
    if (disabled || isSaving) {
      return;
    }

    setIsSaving(true);
    setActivePreset(payload.preset ?? (payload.customDate ? "CUSTOM" : null));
    setError(null);

    const previousSummary = followUpSummary;
    const optimisticFollowUp = buildOptimisticFollowUp(payload.remindAt);
    const rollback = optimisticallyInsertFollowUp(optimisticFollowUp);

    setFollowUpSummary((current) =>
      mergeFollowUpSummary(current, payload.remindAt),
    );
    resetComposer();

    try {
      const created = await followUpsApi.create({
        relationshipId,
        preset: payload.preset,
        customDate: payload.customDate,
      });
      const reconciledFollowUp = mergeCreatedFollowUp(created, optimisticFollowUp);

      reconcileFollowUp(reconciledFollowUp, { replaceId: optimisticFollowUp.id });
      setFollowUpSummary((current) =>
        reconcileCreatedFollowUpSummary(
          current,
          optimisticFollowUp.remindAt,
          reconciledFollowUp.remindAt,
        ),
      );
      showToast(`Reminder set for ${formatReminder(reconciledFollowUp.remindAt)}`);
    } catch (submissionError) {
      rollback();
      setFollowUpSummary(previousSummary);
      setError(
        submissionError instanceof ApiError
          ? submissionError.message
          : "Could not save this reminder right now.",
      );
    } finally {
      setIsSaving(false);
      setActivePreset(null);
    }
  }

  async function handlePresetCreate(preset: FollowUpPreset) {
    const optimisticRemindAt = new Date();

    switch (preset) {
      case "TOMORROW":
        optimisticRemindAt.setDate(optimisticRemindAt.getDate() + 1);
        break;
      case "NEXT_WEEK":
        optimisticRemindAt.setDate(optimisticRemindAt.getDate() + 7);
        break;
      case "ONE_MONTH":
        optimisticRemindAt.setDate(optimisticRemindAt.getDate() + 30);
        break;
    }

    await createFollowUp({
      preset,
      remindAt: optimisticRemindAt.toISOString(),
    });
  }

  async function handleCustomDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customDate) {
      setError("Pick a date and time for this reminder.");
      return;
    }

    const resolvedCustomDate = toCustomDateIsoString(customDate);

    if (!resolvedCustomDate || new Date(resolvedCustomDate).getTime() <= Date.now()) {
      setError("Pick a future date and time for this reminder.");
      return;
    }

    await createFollowUp({
      customDate: resolvedCustomDate,
      remindAt: resolvedCustomDate,
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {QUICK_PRESETS.map((option) => (
            <PrimaryButton
              key={option.preset}
              type="button"
              className="min-h-12"
              disabled={disabled || isSaving}
              onClick={() => {
                void handlePresetCreate(option.preset);
              }}
            >
              {activePreset === option.preset && isSaving
                ? "Setting..."
                : option.label}
            </PrimaryButton>
          ))}
        </div>

        {!isCustomDateOpen ? (
          <button
            type="button"
            onClick={() => {
              setIsCustomDateOpen(true);
              setError(null);
            }}
            disabled={disabled || isSaving}
            className="text-sm font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
          >
            Pick date and time
          </button>
        ) : (
          <form
            className="flex flex-col gap-2 rounded-2xl border border-border bg-surface/50 p-3 sm:flex-row"
            onSubmit={(event) => {
              void handleCustomDateSubmit(event);
            }}
          >
            <label className="flex-1 space-y-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                When should this come back up?
              </span>
              <input
                type="datetime-local"
                value={customDate}
                min={getMinimumCustomDateTimeValue()}
                onChange={(event) => {
                  setCustomDate(event.target.value);
                  setError(null);
                }}
                className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-foreground outline-none transition-all focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20"
              />
            </label>

            <div className="flex gap-2 sm:self-end">
              <SecondaryButton
                type="button"
                size="sm"
                className="min-h-12 flex-1 sm:flex-none"
                disabled={isSaving}
                onClick={() => {
                  resetComposer();
                }}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton
                type="submit"
                size="sm"
                className="min-h-12 flex-1 sm:flex-none"
                disabled={disabled || isSaving}
              >
                {activePreset === "CUSTOM" && isSaving
                  ? "Setting..."
                  : "Schedule reminder"}
              </PrimaryButton>
            </div>
          </form>
        )}

        {error ? (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
            <p className="font-sans text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>
          </div>
        ) : null}
      </div>

      {hasPendingReminder ? (
        <div
          className={cn(
            "rounded-2xl border px-4 py-4 sm:px-5",
            followUpSummaryState?.tone === "error"
              ? "border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/20"
              : followUpSummaryState?.tone === "warning"
                ? "border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/20"
                : "border-border bg-surface/70",
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {followUpSummaryState?.eyebrow ?? "Follow up"}
                </p>
                {followUpSummaryState?.tone ? (
                  <StatusBadge
                    label={
                      followUpSummaryState.tone === "cyan"
                        ? "Gentle"
                        : followUpSummaryState.tone === "error"
                        ? "Overdue"
                        : "Ready"
                    }
                    tone={followUpSummaryState.tone}
                    dot
                  />
                ) : null}
              </div>
              <p className="text-sm font-semibold text-foreground">
                {followUpSummaryState?.title ??
                  `Follow up ${formatFollowUpLabel(followUpSummary.nextFollowUpAt!)}`}
              </p>
              <p className="text-xs text-muted">
                Next up {formatFollowUpLabel(followUpSummary.nextFollowUpAt!)} at{" "}
                {formatReminder(followUpSummary.nextFollowUpAt!)}
              </p>
              <p className="text-xs text-muted">
                {followUpSummaryState?.detail ??
                  formatReminderCount(followUpSummary.pendingFollowUpCount)}
              </p>
            </div>

            <Link
              href={routes.app.followUps}
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              Open follow-ups
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface/40 px-4 py-4 text-sm text-muted">
          Set a one-tap reminder for the next conversation.
        </div>
      )}
    </div>
  );
}
