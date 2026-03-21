"use client";

import Link from "next/link";
import { useState } from "react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { authApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";

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
      if (
        submissionError instanceof ApiError &&
        (submissionError.status === 429 || /wait|too many/i.test(submissionError.message))
      ) {
        setErrorTone("warning");
        setError(
          "Too many reset requests for this address right now. Wait a moment and use the latest email from Dotly if one already arrived.",
        );
      } else {
        setErrorTone("error");
      setError(
        submissionError instanceof ApiError
          ? submissionError.message
          : "Unable to start password recovery right now.",
      );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-[440px] space-y-6 py-10">
      <div className="space-y-2 text-center">
        <p className="label-xs text-muted">Account Recovery</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Reset your password
        </h1>
        <p className="text-sm leading-6 text-muted">
          Enter your email and Dotly will send a one-time reset link if the
          account exists.
        </p>
      </div>

      <form
        className="glass space-y-4 rounded-[28px] border border-border bg-surface p-6"
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <label
            className="text-sm font-semibold text-foreground"
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
            className="min-h-[54px] w-full rounded-[16px] border border-black/10 bg-white/60 px-4 text-sm text-foreground outline-none transition focus:border-brandRose focus:ring-[3px] focus:ring-brandRose/15 dark:border-white/10 dark:bg-white/[0.03] dark:focus:border-brandCyan dark:focus:ring-brandCyan/15"
            placeholder="name@example.com"
            required
          />
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
          Send reset link
        </PrimaryButton>

        <p className="text-center text-sm text-muted">
          Remembered it?{" "}
          <Link
            href={routes.public.login}
            className="font-semibold text-brandRose transition-colors hover:text-brandRose/80 dark:text-brandCyan dark:hover:text-brandCyan/80"
          >
            Back to login
          </Link>
        </p>
      </form>
    </section>
  );
}
