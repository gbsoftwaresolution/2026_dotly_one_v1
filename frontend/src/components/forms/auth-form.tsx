"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { authApi } from "@/lib/api";
import { isApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";

type AuthMode = "login" | "signup";

interface AuthFormProps {
  mode: AuthMode;
  redirectTo?: string;
  initialEmail?: string;
}

function getDefaultErrorMessage(mode: AuthMode): string {
  return mode === "login"
    ? "Unable to log in. Please check your details and try again."
    : "Unable to create your account right now. Please try again.";
}

function sanitizeRedirectPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return routes.app.home;
  }

  return path;
}

export function AuthForm({
  mode,
  redirectTo = routes.app.home,
  initialEmail = "",
}: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const content = useMemo(
    () =>
      mode === "login"
        ? {
            title: "Welcome back",
            submitLabel: "Log in",
            alternateLabel: "Need an account?",
            alternateHref: routes.public.signup,
            alternateAction: "Sign up",
          }
        : {
            title: "Create your account",
            submitLabel: "Create account",
            alternateLabel: "Already have an account?",
            alternateHref: routes.public.login,
            alternateAction: "Log in",
          },
    [mode],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        await authApi.signup({ email, password });
        setSuccessMessage("Account created. You can log in now.");
        router.push(
          `${routes.public.login}?email=${encodeURIComponent(email)}&created=1`,
        );
        router.refresh();
        return;
      }

      await authApi.login({ email, password });
      router.replace(sanitizeRedirectPath(redirectTo));
      router.refresh();
    } catch (submissionError) {
      setError(
        isApiError(submissionError)
          ? submissionError.message
          : getDefaultErrorMessage(mode),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {/* Title block */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {content.title}
        </h2>
        <p className="text-sm leading-6 text-muted">
          Use your email and password to access your Dotly workspace.
        </p>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label className="label-xs" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          required
          autoComplete="email"
          className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm font-medium text-foreground outline-none backdrop-blur-xl transition-all focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20 placeholder:text-muted/50"
          placeholder="name@example.com"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label className="label-xs" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          required
          minLength={6}
          maxLength={72}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm font-medium text-foreground outline-none backdrop-blur-xl transition-all focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20 placeholder:text-muted/50"
          placeholder="At least 6 characters"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
          <p className="font-mono text-sm text-rose-500 dark:text-rose-400">
            {error}
          </p>
        </div>
      ) : null}

      {/* Success */}
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
            {successMessage}
          </p>
        </div>
      ) : null}

      <PrimaryButton type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Please wait..." : content.submitLabel}
      </PrimaryButton>

      <p className="text-center text-sm text-muted">
        {content.alternateLabel}{" "}
        <Link
          href={content.alternateHref}
          className="font-semibold text-brandRose underline-offset-4 hover:underline dark:text-brandCyan"
        >
          {content.alternateAction}
        </Link>
      </p>
    </form>
  );
}
