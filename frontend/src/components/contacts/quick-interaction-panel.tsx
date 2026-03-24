"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { showToast } from "@/components/shared/toast-viewport";
import { contactsApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { formatTimeAgoShort } from "@/lib/utils/format-time-ago";
import type {
  ContactRecentInteraction,
  QuickInteractionType,
} from "@/types/contact";

interface QuickInteractionPanelProps {
  relationshipId: string;
  disabled?: boolean;
  recentInteractions?: ContactRecentInteraction[];
}

interface QuickInteractionOption {
  type: QuickInteractionType;
  label: string;
  successMessage: string;
}

const QUICK_INTERACTION_OPTIONS: QuickInteractionOption[] = [
  {
    type: "GREETING",
    label: "Say hi",
    successMessage: "Hi logged to this connection.",
  },
  {
    type: "FOLLOW_UP",
    label: "Follow up",
    successMessage: "Follow-up signal logged to this connection.",
  },
  {
    type: "THANK_YOU",
    label: "Thank them",
    successMessage: "Thank-you logged to this connection.",
  },
];

function getInteractionLabel(interaction: ContactRecentInteraction) {
  switch (interaction.type) {
    case "GREETING":
      return interaction.direction === "sent" ? "You said hi" : "They said hi";
    case "FOLLOW_UP":
      return interaction.direction === "sent"
        ? "You sent a follow-up signal"
        : "They sent a follow-up signal";
    case "THANK_YOU":
      return interaction.direction === "sent"
        ? "You sent thanks"
        : "They sent thanks";
  }
}

function getInteractionTimeLabel(createdAt: string) {
  return formatTimeAgoShort(createdAt) ?? "now";
}

export function QuickInteractionPanel({
  relationshipId,
  disabled = false,
  recentInteractions = [],
}: QuickInteractionPanelProps) {
  const router = useRouter();
  const [activeType, setActiveType] = useState<QuickInteractionType | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  async function handleQuickInteraction(option: QuickInteractionOption) {
    if (disabled || activeType) {
      return;
    }

    setActiveType(option.type);
    setFeedback(null);

    try {
      await contactsApi.sendQuickInteraction(relationshipId, {
        type: option.type,
      });

      setFeedback({ tone: "success", message: option.successMessage });
      showToast(option.successMessage);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "Could not send that right now.",
      });
    } finally {
      setActiveType(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-sans text-lg font-semibold text-foreground">
          Quick reconnect
        </h2>
        <p className="font-sans text-sm text-muted">
          Log a one-tap signal on this connection. It updates activity history
          without starting a chat.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {QUICK_INTERACTION_OPTIONS.map((option, index) => {
          const ButtonComponent = index === 0 ? PrimaryButton : SecondaryButton;
          const isLoading = activeType === option.type;

          return (
            <ButtonComponent
              key={option.type}
              type="button"
              onClick={() => void handleQuickInteraction(option)}
              isLoading={isLoading}
              disabled={disabled || Boolean(activeType)}
              fullWidth
              className="min-h-16 text-base"
            >
              {option.label}
            </ButtonComponent>
          );
        })}
      </div>

      {feedback ? (
        <div
          className={
            feedback.tone === "success"
              ? "rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3"
              : "rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3"
          }
        >
          <p
            role="status"
            className={
              feedback.tone === "success"
                ? "font-sans text-sm text-emerald-700 dark:text-emerald-300"
                : "font-sans text-sm text-rose-600 dark:text-rose-400"
            }
          >
            {feedback.message}
          </p>
        </div>
      ) : null}

      {disabled ? (
        <p className="font-sans text-xs text-muted">
          Quick interactions are unavailable because this connection window has
          closed.
        </p>
      ) : null}

      {recentInteractions.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-border/80 bg-surface/40 px-4 py-4">
          <h3 className="font-sans text-sm font-semibold text-foreground">
            Recent signals
          </h3>
          <ul className="space-y-1.5">
            {recentInteractions.map((interaction) => (
              <li
                key={interaction.id}
                className="flex items-center justify-between gap-3 font-sans text-sm leading-6 text-foreground/85"
              >
                <span>{getInteractionLabel(interaction)}</span>
                <span className="shrink-0 text-xs uppercase tracking-wide text-muted">
                  {getInteractionTimeLabel(interaction.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}