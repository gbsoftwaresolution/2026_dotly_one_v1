"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthPageShell } from "@/components/layout/auth-page-shell";
import { PrimaryButton } from "@/components/shared/primary-button";
import { authApi } from "@/lib/api";
import { routes } from "@/lib/constants/routes";
import { classifyAuthError } from "@/lib/utils/auth-errors";

const INPUT_CLASSES =
  "peer min-h-[54px] w-full rounded-[16px] border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] px-4 pt-4 pb-1.5 text-[15px] font-medium text-foreground outline-none backdrop-blur-2xl transition-all duration-300 hover:border-black/20 dark:hover:border-white/20 hover:bg-white/70 dark:hover:bg-white/[0.05] focus:bg-white dark:focus:bg-black focus:border-brandRose focus:ring-[3px] focus:ring-brandRose/15 dark:focus:border-brandCyan dark:focus:ring-brandCyan/15 placeholder:text-transparent shadow-sm";

const LABEL_CLASSES =
  "absolute left-4 top-4 z-10 origin-[0] -translate-y-2.5 scale-[0.85] transform text-[13px] text-muted-foreground duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-2.5 peer-focus:scale-[0.85] peer-focus:text-brandRose dark:peer-focus:text-brandCyan pointer-events-none";

function getResendErrorMessage(error: unknown): string {
  if (classifyAuthError(error).kind === "throttled") {
    return "Please wait a minute before asking for another verification email.";
  }

  return "We couldn't send another verification email right now. Please try again shortly.";
}

type VerificationStatus = "ready" | "verifying" | "success" | "invalid";

export function VerifyEmailFlow({
  initialToken,
  initialEmail = "",
}: {
  initialToken?: string;
  initialEmail?: string;
}) {
  const [status, setStatus] = useState<VerificationStatus>(
    initialToken ? "verifying" : "ready",
  );
  const [email, setEmail] = useState(initialEmail);
  const [verifiedEmail, setVerifiedEmail] = useState(initialEmail);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!initialToken) {
      return;
    }

    let cancelled = false;

    setStatus("verifying");
    setError(null);
    setFeedback(null);

    void authApi
      .verifyEmail(initialToken)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setVerifiedEmail(result.user.email);
        setStatus("success");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setStatus("invalid");
        setError(
          "This link is invalid or expired. Request a fresh one below.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [initialToken]);

  async function handleResend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    setFeedback(null);
    setError(null);

    if (!normalizedEmail) {
      setError("Enter the email address you used for Dotly.");
      return;
    }

    setIsResending(true);

    try {
      const result = await authApi.resendVerificationEmail({
        email: normalizedEmail,
      });

      setFeedback(
        result.verificationEmailSent
          ? "A new link is on the way. Check your inbox and spam folder."
          : result.mailDeliveryAvailable
            ? "Verification is still pending. Check your inbox for the latest message from Dotly."
            : "Delivery is disabled in this environment, but the resend flow is ready for production mail.",
      );
    } catch (resendError) {
      setError(getResendErrorMessage(resendError));
    } finally {
      setIsResending(false);
    }
  }

  const loginHref = verifiedEmail
    ? `${routes.public.login}?email=${encodeURIComponent(verifiedEmail)}&verified=1`
    : `${routes.public.login}?verified=1`;

  const title =
    status === "verifying"
      ? "Verifying your email"
      : status === "success"
        ? "Email verified"
        : status === "invalid"
          ? "Request a new verification link"
          : "Verify your email";

  const description =
    status === "verifying"
      ? "Checking your verification link now."
      : status === "success"
        ? "Your account is ready for verified sharing and trust-based access."
        : status === "invalid"
          ? "This verification link is invalid or expired. Enter your email address and Dotly will send a fresh one."
          : "Enter your email address and Dotly will send another verification link if you still need one.";

  return (
    <AuthPageShell title={title} description={description}>
      <div className="glass rounded-3xl border border-border/60 p-6 shadow-shell sm:p-7">
        {status === "verifying" ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-current border-t-transparent text-brandRose dark:text-brandCyan" />
          </div>
        ) : status === "success" ? (
          <div className="space-y-4 text-center">
            <Link href={loginHref} className="block">
              <PrimaryButton className="w-full rounded-2xl">Open Dotly</PrimaryButton>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {error ? (
              <div className="rounded-[1rem] border border-rose-500/20 bg-rose-500/5 px-4 py-3">
                <p className="text-[13px] font-medium text-rose-600 dark:text-rose-400">
                  {error}
                </p>
              </div>
            ) : null}

            {feedback ? (
              <div className="rounded-[1rem] border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                <p className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
                  {feedback}
                </p>
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={handleResend}>
              <div className="relative">
                <input
                  id="verification-email"
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError(null);
                  }}
                  className={INPUT_CLASSES}
                />
                <label htmlFor="verification-email" className={LABEL_CLASSES}>
                  Email address
                </label>
              </div>

              <PrimaryButton
                type="submit"
                className="w-full rounded-2xl"
                disabled={isResending}
                isLoading={isResending}
              >
                Resend link
              </PrimaryButton>
            </form>

            <p className="text-center text-sm text-muted">
              <Link
                href={routes.public.login}
                className="font-semibold text-brandRose transition-colors hover:text-brandRose/80 dark:text-brandCyan dark:hover:text-brandCyan/80"
              >
                Back to login
              </Link>
            </p>
          </div>
        )}
      </div>
    </AuthPageShell>
  );
}
