"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Sparkles } from "lucide-react";

import { AuthPageShell } from "@/components/layout/auth-page-shell";
import { PrimaryButton } from "@/components/shared/primary-button";
import { authApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";

type ResetViewState = "ready" | "missing" | "expired";

function getPasswordStrength(password: string): string {
  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score >= 5 ? "Strong" : score >= 3 ? "Good" : "Needs work";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorTone, setErrorTone] = useState<"warning" | "error">("error");
  const [viewState, setViewState] = useState<ResetViewState>(
    token ? "ready" : "missing",
  );

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);
    setErrorTone("error");

    try {
      await authApi.resetPassword({ token, password });
      setMessage("Password reset complete. Redirecting you to login...");
      setTimeout(() => {
        router.push(`${routes.public.login}?reason=password-reset`);
      }, 1000);
    } catch (submissionError) {
      if (
        submissionError instanceof ApiError &&
        /invalid or expired/i.test(submissionError.message)
      ) {
        setViewState("expired");
        setError(submissionError.message);
      } else if (
        submissionError instanceof ApiError &&
        (submissionError.status === 429 ||
          /wait|too many/i.test(submissionError.message))
      ) {
        setErrorTone("warning");
        setError(
          "Too many reset attempts right now. Wait a moment, then use the latest recovery email from Dotly.",
        );
      } else {
        setErrorTone("error");
        setError(
          submissionError instanceof ApiError
            ? submissionError.message
            : "Unable to reset your password right now.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const BackgroundGlow = () => (
    <div className="fixed inset-0 z-[-1] pointer-events-none bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl" />
  );

  if (viewState === "missing") {
    return (
      <>
        <BackgroundGlow />
        <AuthPageShell
          title="Invalid link."
          description="This reset link is missing what it needs to continue. Request a new one and try again."
        >
          <div className="rounded-[2.5rem] p-8 md:p-12 relative z-10 text-center shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-2xl">
            <Link
              href={routes.public.forgotPassword}
              className="inline-flex h-14 items-center rounded-full bg-foreground px-8 text-[15px] font-semibold text-background transition-transform hover:scale-[0.98] shadow-md tap-feedback"
            >
              Request another reset link
            </Link>
          </div>
        </AuthPageShell>
      </>
    );
  }

  if (viewState === "expired") {
    return (
      <>
        <BackgroundGlow />
        <AuthPageShell
          title="Link expired."
          description={
            error ??
            "This reset link is no longer valid. Request a fresh one to keep going."
          }
        >
          <div className="rounded-[2.5rem] p-8 md:p-12 relative z-10 text-center shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-2xl">
            <Link
              href={routes.public.forgotPassword}
              className="inline-flex h-14 items-center rounded-full bg-foreground px-8 text-[15px] font-semibold text-background transition-transform hover:scale-[0.98] shadow-md tap-feedback"
            >
              Request another reset link
            </Link>
          </div>
        </AuthPageShell>
      </>
    );
  }

  return (
    <>
      <BackgroundGlow />
      <AuthPageShell
        title="Secure your account."
        description="This reset link is single-use and signs every device out when the reset completes."
      >
        <form
          className="space-y-6 rounded-[32px] bg-white/60 backdrop-blur-3xl p-8 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 relative z-10"
          onSubmit={handleSubmit}
        >
          <div className="flex justify-center mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-foreground/[0.03] dark:bg-foreground/[0.05] ring-1 ring-black/5 dark:ring-white/10">
              <Shield className="h-6 w-6 text-foreground" strokeWidth={1.5} />
            </div>
          </div>

          <div className="space-y-2">
            <label
              className="text-[13px] font-medium text-muted ml-4"
              htmlFor="reset-password"
            >
              New password
            </label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-[56px] w-full rounded-2xl bg-white/50 dark:bg-zinc-800/50 backdrop-blur-md px-4 py-3 text-[16px] font-medium text-foreground outline-none transition-all duration-300 ring-1 ring-black/5 dark:ring-white/10 placeholder:text-muted/50 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
              placeholder="Create a stronger password"
              required
            />
            <div className="flex justify-between items-center px-2 pt-1">
              <p className="text-[13px] text-muted">
                Must be at least 6 characters.
              </p>
              {password.length > 0 && (
                <p
                  className={`text-[12px] font-bold uppercase tracking-wider ${strength === "Strong" ? "text-status-success" : strength === "Good" ? "text-accent" : "text-status-warning"}`}
                >
                  {strength}
                </p>
              )}
            </div>
          </div>

          {message ? (
            <div className="rounded-[16px] bg-status-success/10 px-5 py-4 ring-1 ring-status-success/20">
              <p className="text-[14px] leading-relaxed font-medium text-status-success">
                {message}
              </p>
            </div>
          ) : null}

          {error ? (
            <div
              className={
                errorTone === "warning"
                  ? "rounded-[16px] bg-status-warning/10 px-5 py-4 ring-1 ring-status-warning/20"
                  : "rounded-[16px] bg-status-error/10 px-5 py-4 ring-1 ring-status-error/20"
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
              Reset password
            </PrimaryButton>
          </div>

          <p className="text-center text-[15px] font-medium text-muted pt-2">
            Need a new link?{" "}
            <Link
              href={routes.public.forgotPassword}
              className="font-semibold text-foreground transition-colors hover:text-accent ml-1"
            >
              Request another email
            </Link>
          </p>
        </form>
      </AuthPageShell>
    </>
  );
}
