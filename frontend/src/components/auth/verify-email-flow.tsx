"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthPageShell } from "@/components/layout/auth-page-shell";
import { PrimaryButton } from "@/components/shared/primary-button";
import { authApi } from "@/lib/api";
import { routes } from "@/lib/constants/routes";
import { classifyAuthError } from "@/lib/utils/auth-errors";

const INPUT_CLASSES =
  "peer min-h-[56px] w-full rounded-[16px] bg-foreground/[0.03] px-4 pt-5 pb-2 text-[16px] font-medium text-foreground outline-none transition-all duration-300 shadow-inner ring-1 ring-black/5 placeholder:text-transparent focus:bg-foreground/[0.045] focus:ring-2 focus:ring-foreground/15 focus:shadow-md dark:bg-white/[0.045] dark:ring-white/10 dark:focus:bg-white/[0.07]";

const LABEL_CLASSES =
  "absolute left-4 top-4 z-10 origin-[0] -translate-y-2 scale-[0.80] transform text-[13px] font-medium text-muted transition-all duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-muted/70 peer-focus:-translate-y-2 peer-focus:scale-[0.80] peer-focus:text-accent pointer-events-none";

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
        setError("This link is invalid or expired. Request a fresh one below.");
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
    <>
      <div className="fixed inset-0 z-[-1] pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] h-[1000px] w-[1000px] rounded-full bg-accent/5 blur-[150px] mix-blend-normal opacity-40" />
      </div>

      <AuthPageShell title={title} description={description}>
        <div className="rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-14 relative z-10 border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          {status === "verifying" ? (
            <div className="space-y-4 text-center py-6">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-current border-t-transparent text-accent" />
            </div>
          ) : status === "success" ? (
            <div className="space-y-4 text-center">
              <Link href={loginHref} className="block tap-feedback">
                <PrimaryButton className="w-full">Open Dotly</PrimaryButton>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {error ? (
                <div className="rounded-[16px] bg-status-error/10 px-4 py-3.5 ring-1 ring-status-error/20">
                  <p className="text-[14px] font-medium text-status-error">
                    {error}
                  </p>
                </div>
              ) : null}

              {feedback ? (
                <div className="rounded-[16px] bg-status-success/10 px-4 py-3.5 ring-1 ring-status-success/20">
                  <p className="text-[14px] font-medium text-status-success">
                    {feedback}
                  </p>
                </div>
              ) : null}

              <form className="space-y-6" onSubmit={handleResend}>
                <div className="relative group">
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

                <div className="pt-2">
                  <PrimaryButton
                    type="submit"
                    className="w-full"
                    disabled={isResending}
                    isLoading={isResending}
                  >
                    Resend link
                  </PrimaryButton>
                </div>
              </form>

              <p className="text-center text-[15px] font-medium text-muted pt-2">
                <Link
                  href={routes.public.login}
                  className="font-semibold text-foreground transition-colors hover:text-accent"
                >
                  Back to login
                </Link>
              </p>
            </div>
          )}
        </div>
      </AuthPageShell>
    </>
  );
}
