"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
import { cn } from "@/lib/utils/cn";
import type { FollowUp } from "@/types/follow-up";
import type { ContactFollowUpSummary } from "@/types/contact";

const MAX_NOTE_LENGTH = 1000;

interface ContactFollowUpFormProps {
  relationshipId: string;
  contactName: string;
  initialFollowUpSummary?: ContactFollowUpSummary | null;
  disabled?: boolean;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTimeInputValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getDefaultReminderValues() {
  const nextHour = new Date();
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

  return {
    date: formatDateInputValue(nextHour),
    time: formatTimeInputValue(nextHour),
  };
}

function toIsoString(date: string, time: string) {
  const combined = new Date(`${date}T${time}`);

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
    timeZoneName: "short",
  }).format(new Date(value));
}

function getFollowUpSummaryState(summary: ContactFollowUpSummary | null) {
  if (!summary?.hasPendingFollowUp || !summary.nextFollowUpAt) {
    return null;
  }

  if (summary.isOverdue) {
    return {
      eyebrow: "Pick this back up",
      title: "This conversation is waiting on you.",
      tone: "error" as const,
    };
  }

  if (summary.isTriggered) {
    return {
      eyebrow: "Ready now",
      title: "This is ready for a quick follow-up.",
      tone: "warning" as const,
    };
  }

  return {
    eyebrow: "Next touchpoint",
    title: "Keep the next conversation in view.",
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
    ...flags,
  };
}

export function ContactFollowUpForm({
  relationshipId,
  contactName,
  initialFollowUpSummary = null,
  disabled = false,
}: ContactFollowUpFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState(() => getDefaultReminderValues().date);
  const [time, setTime] = useState(() => getDefaultReminderValues().time);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpSummary, setFollowUpSummary] =
    useState<ContactFollowUpSummary | null>(initialFollowUpSummary);

  const isOverLimit = note.length > MAX_NOTE_LENGTH;
  const charsLeft = MAX_NOTE_LENGTH - note.length;
  const hasPendingReminder =
    followUpSummary?.hasPendingFollowUp && followUpSummary.nextFollowUpAt;
  const followUpSummaryState = getFollowUpSummaryState(followUpSummary);

  function resetForm() {
    const nextDefaults = getDefaultReminderValues();
    setDate(nextDefaults.date);
    setTime(nextDefaults.time);
    setNote("");
    setError(null);
  }

  function handleOpen() {
    resetForm();
    setIsOpen(true);
  }

  function buildOptimisticFollowUp(remindAt: string): FollowUp {
    const optimisticTimestamp = new Date().toISOString();

    return {
      id: `optimistic-follow-up-${relationshipId}-${Date.now()}`,
      relationshipId,
      remindAt,
      status: "pending",
      note: note.trim() ? note.trim() : null,
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled || isSaving) {
      return;
    }

    if (!date || !time) {
      setError("Choose when you want to revisit this.");
      return;
    }

    if (isOverLimit) {
      setError("Keep the note under 1000 characters.");
      return;
    }

    const remindAt = toIsoString(date, time);

    if (!remindAt) {
      setError("Enter a valid follow-up time.");
      return;
    }

    if (new Date(remindAt).getTime() <= Date.now()) {
      setError("Pick a future time for this follow-up.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const previousSummary = followUpSummary;
    const previousDate = date;
    const previousTime = time;
    const previousNote = note;
    const optimisticFollowUp = buildOptimisticFollowUp(remindAt);
    const rollback = optimisticallyInsertFollowUp(optimisticFollowUp);

    setFollowUpSummary((current) => mergeFollowUpSummary(current, remindAt));
    resetForm();
    setIsOpen(false);

    try {
      const created = await followUpsApi.create({
        relationshipId,
        remindAt,
        note: note.trim() ? note.trim() : null,
      });

      reconcileFollowUp(created, { replaceId: optimisticFollowUp.id });
      showToast("Reminder set");
    } catch (submissionError) {
      rollback();
      setFollowUpSummary(previousSummary);
      setDate(previousDate);
      setTime(previousTime);
      setNote(previousNote);
      setIsOpen(true);
      setError(
        submissionError instanceof ApiError
          ? submissionError.message
          : "Could not save this reminder right now.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
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
                  {followUpSummaryState?.eyebrow ?? "Next touchpoint"}
                </p>
                {followUpSummaryState?.tone ? (
                  <StatusBadge
                    label={
                      followUpSummaryState.tone === "error"
                        ? "Overdue"
                        : "Ready"
                    }
                    tone={followUpSummaryState.tone}
                    dot
                  />
                ) : null}
              </div>
              <p className="text-sm font-medium text-foreground">
                {formatReminder(followUpSummary.nextFollowUpAt!)}
              </p>
              <p className="text-xs text-muted">
                {followUpSummaryState?.title ??
                  "Keep the next touchpoint in view."}
              </p>
              {followUpSummary.pendingFollowUpCount > 1 ? (
                <p className="text-xs text-muted">
                  {followUpSummary.pendingFollowUpCount} follow-ups waiting
                </p>
              ) : null}
            </div>

            <Link
              href={routes.app.followUps}
              className="inline-flex min-h-12 items-center justify-center self-start rounded-2xl border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:border-black/15 hover:bg-white dark:hover:border-white/15 dark:hover:bg-white/[0.08] sm:self-auto"
            >
              View follow-ups
            </Link>
          </div>
        </div>
      ) : null}

      {!isOpen ? (
        <SecondaryButton
          type="button"
          fullWidth
          onClick={handleOpen}
          disabled={disabled}
        >
          Add follow-up
        </SecondaryButton>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                Date
              </span>
              <input
                type="date"
                value={date}
                min={formatDateInputValue(new Date())}
                onChange={(event) => {
                  setDate(event.target.value);
                  setError(null);
                }}
                className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-foreground outline-none transition-all focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20"
              />
            </label>

            <label className="space-y-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                Time
              </span>
              <input
                type="time"
                value={time}
                onChange={(event) => {
                  setTime(event.target.value);
                  setError(null);
                }}
                className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-foreground outline-none transition-all focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
              Note
            </span>
            <textarea
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setError(null);
              }}
              rows={4}
              placeholder="Optional context for when you pick this back up"
              className={cn(
                "w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted/60 focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20",
                isOverLimit ? "border-rose-300 dark:border-rose-800" : "",
              )}
            />
            <div className="flex justify-end px-1">
              <span
                className={cn(
                  "font-mono text-[10px] uppercase tracking-widest",
                  isOverLimit ? "text-rose-500" : "text-muted",
                )}
              >
                {isOverLimit
                  ? `${Math.abs(charsLeft)} chars over`
                  : `${charsLeft} chars remaining`}
              </span>
            </div>
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
              <p className="font-sans text-sm text-rose-600 dark:text-rose-400">
                {error}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <SecondaryButton
              type="button"
              fullWidth
              className="sm:w-auto"
              onClick={() => {
                resetForm();
                setIsOpen(false);
              }}
              disabled={isSaving}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="submit"
              fullWidth
              className="sm:w-auto"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save follow-up"}
            </PrimaryButton>
          </div>
        </form>
      )}
    </div>
  );
}
