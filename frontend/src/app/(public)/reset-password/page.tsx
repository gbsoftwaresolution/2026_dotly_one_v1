"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
        (submissionError.status === 429 || /wait|too many/i.test(submissionError.message))
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

  if (viewState === "missing") {
    return (
      <section className="mx-auto max-w-[440px] space-y-6 py-10">
        <div className="glass rounded-[28px] border border-border bg-surface p-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Invalid reset link
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            This reset link is missing its token. Request a new one to continue.
          </p>
          <Link
            href={routes.public.forgotPassword}
            className="mt-4 inline-flex text-sm font-semibold text-brandRose transition-colors hover:text-brandRose/80 dark:text-brandCyan dark:hover:text-brandCyan/80"
          >
            Request another reset link
          </Link>
        </div>
      </section>
    );
  }

  if (viewState === "expired") {
    return (
      <section className="mx-auto max-w-[440px] space-y-6 py-10">
        <div className="glass rounded-[28px] border border-border bg-surface p-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Reset link expired
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {error ??
              "This reset link is no longer valid. Request a fresh one to keep going."}
          </p>
          <Link
            href={routes.public.forgotPassword}
            className="mt-4 inline-flex text-sm font-semibold text-brandRose transition-colors hover:text-brandRose/80 dark:text-brandCyan dark:hover:text-brandCyan/80"
          >
            Request another reset link
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[440px] space-y-6 py-10">
      <div className="space-y-2 text-center">
        <p className="label-xs text-muted">Secure Reset</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Choose a new password
        </h1>
        <p className="text-sm leading-6 text-muted">
          This link is single-use and signs every device out when the reset
          completes.
        </p>
      </div>

      <form
        className="glass space-y-4 rounded-[28px] border border-border bg-surface p-6"
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <label
            className="text-sm font-semibold text-foreground"
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
            className="min-h-[54px] w-full rounded-[16px] border border-black/10 bg-white/60 px-4 text-sm text-foreground outline-none transition focus:border-brandRose focus:ring-[3px] focus:ring-brandRose/15 dark:border-white/10 dark:bg-white/[0.03] dark:focus:border-brandCyan dark:focus:ring-brandCyan/15"
            placeholder="Create a stronger password"
            required
          />
          <p className="text-xs leading-5 text-muted">Strength: {strength}</p>
        </div>

        {message ? (
          <div className="rounded-[20px] border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-foreground/85">
            {message}
          </div>
        ) : null}

        {error ? (
          <div
            className={
              errorTone === "warning"
                ? "rounded-[20px] border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-foreground/85"
                : "rounded-[20px] border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-foreground/85"
            }
          >
            {error}
          </div>
        ) : null}

        <PrimaryButton type="submit" fullWidth isLoading={isSubmitting}>
          Reset password
        </PrimaryButton>

        <p className="text-center text-sm text-muted">
          Need a new link?{" "}
          <Link
            href={routes.public.forgotPassword}
            className="font-semibold text-brandRose transition-colors hover:text-brandRose/80 dark:text-brandCyan dark:hover:text-brandCyan/80"
          >
            Request another reset email
          </Link>
        </p>
      </form>
    </section>
  );
}
