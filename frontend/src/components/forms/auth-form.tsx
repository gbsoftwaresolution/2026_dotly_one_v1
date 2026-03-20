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
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground dark:text-white">
          {content.title}
        </h2>
        <p className="text-sm leading-6 text-muted dark:text-zinc-400">
          Use your email and password to access your Dotly workspace.
        </p>
      </div>

      <div className="space-y-2">
        <label
          className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500"
          htmlFor="email"
        >
          Email
        </label>
        <input
          id="email"
          required
          autoComplete="email"
          className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white/50 px-4 text-sm font-medium text-slate-900 outline-none backdrop-blur-xl transition focus:border-brandRose focus:ring-1 focus:ring-brandRose dark:border-zinc-800 dark:bg-bgOnyx/50 dark:text-white dark:focus:border-brandCyan dark:focus:ring-brandCyan"
          placeholder="name@example.com"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label
          className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500"
          htmlFor="password"
        >
          Password
        </label>
        <input
          id="password"
          required
          minLength={6}
          maxLength={72}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white/50 px-4 text-sm font-medium text-slate-900 outline-none backdrop-blur-xl transition focus:border-brandRose focus:ring-1 focus:ring-brandRose dark:border-zinc-800 dark:bg-bgOnyx/50 dark:text-white dark:focus:border-brandCyan dark:focus:ring-brandCyan"
          placeholder="At least 6 characters"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </p>
      ) : null}

      <PrimaryButton type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Please wait..." : content.submitLabel}
      </PrimaryButton>

      <p className="text-sm text-muted">
        {content.alternateLabel}{" "}
        <Link href={content.alternateHref} className="font-medium text-accent">
          {content.alternateAction}
        </Link>
      </p>
    </form>
  );
}
