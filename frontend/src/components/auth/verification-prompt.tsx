"use client";

import Link from "next/link";
import { useState } from "react";

import { SecondaryButton } from "@/components/shared/secondary-button";
import { authApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

import { VerificationStatusBadge } from "./verification-status-badge";

interface VerificationPromptProps {
  email: string;
  title: string;
  description: string;
  className?: string;
  compact?: boolean;
}

function buildVerifyHref(email: string): string {
  return `${routes.public.verifyEmail}?email=${encodeURIComponent(email)}`;
}

function getResendFeedback(error: unknown): string {
  if (
    error instanceof ApiError &&
    (error.status === 429 || /wait|too many/i.test(error.message))
  ) {
    return "Check your inbox and spam folder. You can request another verification email in about a minute.";
  }

  return "We could not resend your verification email right now. Please try again shortly.";
}

export function VerificationPrompt({
  email,
  title,
  description,
  className,
  compact = false,
}: VerificationPromptProps) {
  const [isResending, setIsResending] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  async function handleResend() {
    setFeedback(null);
    setIsResending(true);

    try {
      const result = await authApi.resendVerificationEmail({ email });

      setFeedback({
        tone: "success",
        message: result.verificationEmailSent
          ? "Verification email sent. Open the latest message from Dotly, or check your spam folder."
          : result.mailDeliveryAvailable
            ? "Verification is still pending. If email delivery is enabled, Dotly will send a fresh link."
            : "Email delivery is unavailable in this environment. Dotly is ready to send a fresh link as soon as mail is configured.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: getResendFeedback(error),
      });
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-3xl border border-amber-500/30 bg-amber-500/10",
        compact ? "px-4 py-4" : "p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <VerificationStatusBadge isVerified={false} />
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-sm leading-6 text-foreground/80">{description}</p>
          <p className="font-mono text-xs text-muted">{email}</p>
        </div>

        {feedback ? (
          <div
            className={cn(
              "rounded-2xl px-4 py-3",
              feedback.tone === "success"
                ? "border border-emerald-500/30 bg-emerald-500/10"
                : "border border-rose-500/30 bg-rose-500/10",
            )}
          >
            <p
              className={cn(
                "font-mono text-xs leading-5",
                feedback.tone === "success"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {feedback.message}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <SecondaryButton
            type="button"
            size={compact ? "sm" : "md"}
            className={cn(compact ? "sm:w-auto" : "sm:flex-1")}
            isLoading={isResending}
            onClick={() => void handleResend()}
          >
            Resend verification email
          </SecondaryButton>

          <Link href={buildVerifyHref(email)} className={cn(compact ? "sm:w-auto" : "sm:flex-1")}>
            <span
              className={cn(
                "inline-flex w-full items-center justify-center rounded-2xl border border-border bg-white/80 px-5 font-semibold text-foreground transition-all hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]",
                compact ? "h-10 text-xs" : "h-14 text-sm",
              )}
            >
              Open verification help
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}