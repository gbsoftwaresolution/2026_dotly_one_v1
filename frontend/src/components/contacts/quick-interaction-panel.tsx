"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { showToast } from "@/components/shared/toast-viewport";
import { contactsApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { QuickInteractionType } from "@/types/contact";

interface QuickInteractionPanelProps {
  relationshipId: string;
  disabled?: boolean;
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
    successMessage: "Marked that you said hi.",
  },
  {
    type: "FOLLOW_UP",
    label: "Follow up",
    successMessage: "Marked that you followed up.",
  },
  {
    type: "THANK_YOU",
    label: "Thank them",
    successMessage: "Marked that you sent thanks.",
  },
];

export function QuickInteractionPanel({
  relationshipId,
  disabled = false,
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
          Capture a small moment on this connection. It updates the story
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

    </div>
  );
}