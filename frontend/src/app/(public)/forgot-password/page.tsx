"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthPageShell } from "@/components/layout/auth-page-shell";
import { PrimaryButton } from "@/components/shared/primary-button";
import { authApi } from "@/lib/api";
import { routes } from "@/lib/constants/routes";
import { classifyAuthError } from "@/lib/utils/auth-errors";

type FeedbackTone = "success" | "warning" | "error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorTone, setErrorTone] = useState<FeedbackTone>("error");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);
    setErrorTone("error");

    try {
      await authApi.forgotPassword({ email: email.trim().toLowerCase() });
      setMessage(
        "If that address belongs to a Dotly account, a reset link is on the way. Check your inbox and spam folder.",
      );
    } catch (submissionError) {
      const classifiedError = classifyAuthError(submissionError);

      if (classifiedError.kind === "throttled") {
        setErrorTone("warning");
        setError(
          "Too many reset requests for this address right now. Wait a moment and use the latest email from Dotly if one already arrived.",
        );
      } else {
        setErrorTone("error");
        setError(
          classifiedError.kind !== "unknown"
            ? classifiedError.message
            : "Unable to start password recovery right now.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* Ambient Background Glow matching Home Page */}
      <div className="fixed inset-0 z-[-1] pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="absolute top-[-10%] h-[1000px] w-[1000px] rounded-full bg-accent/5 blur-[150px] mix-blend-normal opacity-40" />
      </div>

      <AuthPageShell
        title="Reset your password"
        description="Enter your email address and Dotly will send a one-time reset link if the account exists."
      >
        <form
          className="space-y-6 rounded-[2.5rem] p-8 md:p-12 relative z-10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-2xl"
          onSubmit={handleSubmit}
        >
          <div className="space-y-2">
            <label
              className="text-[13px] font-medium text-muted ml-4"
              htmlFor="forgot-email"
            >
              Email address
            </label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-[56px] w-full rounded-[16px] bg-foreground/[0.03] px-4 pt-1 text-[16px] font-medium text-foreground outline-none transition-all duration-300 shadow-inner ring-1 ring-black/5 placeholder:text-muted/50 focus:bg-foreground/[0.045] focus:ring-2 focus:ring-foreground/15 focus:shadow-md dark:bg-white/[0.045] dark:ring-white/10 dark:focus:bg-white/[0.07]"
              placeholder="name@example.com"
              required
            />
          </div>

          {message ? (
            <div className="rounded-[16px] bg-status-success/10 px-4 py-3 ring-1 ring-status-success/20">
              <p className="text-[14px] leading-relaxed font-medium text-status-success">
                {message}
              </p>
            </div>
          ) : null}

          {error ? (
            <div
              className={
                errorTone === "warning"
                  ? "rounded-[16px] bg-status-warning/10 px-4 py-3 ring-1 ring-status-warning/20"
                  : "rounded-[16px] bg-status-error/10 px-4 py-3 ring-1 ring-status-error/20"
              }
            >
              <p
                className={
                  errorTone === "warning"
                    ? "text-[14px] leading-relaxed font-medium text-status-warning"
                    : "text-[14px] leading-relaxed font-medium text-status-error"
                }
              >
                {error}
              </p>
            </div>
          ) : null}

          <div className="pt-2">
            <PrimaryButton type="submit" fullWidth isLoading={isSubmitting}>
              Send reset link
            </PrimaryButton>
          </div>

          <p className="text-center text-[15px] font-medium text-muted pt-2">
            Remembered it?{" "}
            <Link
              href={routes.public.login}
              className="font-semibold text-foreground transition-colors hover:text-accent ml-1"
            >
              Back to login
            </Link>
          </p>
        </form>
      </AuthPageShell>
    </>
  );
}
