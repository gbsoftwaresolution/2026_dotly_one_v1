import Link from "next/link";

import { ResetSessionOnLoad } from "@/components/auth/reset-session-on-load";
import { AuthForm } from "@/components/forms/auth-form";
import { routes } from "@/lib/constants/routes";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    email?: string;
    created?: string;
    delivery?: string;
    verified?: string;
    reason?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const redirectTo = resolvedSearchParams.next || routes.app.home;
  const initialEmail = resolvedSearchParams.email || "";
  const created = resolvedSearchParams.created === "1";
  const verificationDelivered = resolvedSearchParams.delivery !== "disabled";
  const verified = resolvedSearchParams.verified === "1";
  const passwordResetComplete =
    resolvedSearchParams.reason === "password-reset";
  const shouldResetSession = resolvedSearchParams.reason === "expired";
  const resendHref = initialEmail
    ? `${routes.public.verifyEmail}?email=${encodeURIComponent(initialEmail)}`
    : routes.public.verifyEmail;

  return (
    <section className="space-y-5">
      <ResetSessionOnLoad enabled={shouldResetSession} />

      {/* Page intro */}
      <div className="space-y-1 px-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm leading-6 text-muted">
          Log in to manage your personas, sharing flows, and access controls.
        </p>
      </div>

      {/* Banners */}
      {shouldResetSession ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="font-mono text-sm text-amber-600 dark:text-amber-400">
            Your session expired. Log in again to keep working in Dotly.
          </p>
        </div>
      ) : null}
      {verified ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
            Email confirmed. Log in to continue.
          </p>
        </div>
      ) : null}
      {passwordResetComplete ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
            Password reset complete. Log in with your new password.
          </p>
        </div>
      ) : null}
      {created ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          {verificationDelivered ? (
            <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
              Account created. Check your inbox, including spam, for your
              confirmation email. You can still log in now, but verified-only
              sharing stays limited until you confirm it. Need another link?{" "}
              <Link href={resendHref} className="underline underline-offset-4">
                Resend verification
              </Link>
              .
            </p>
          ) : (
            <p className="font-mono text-sm text-amber-700 dark:text-amber-300">
              Account created. Email confirmation is still required, but
              delivery is not configured in this environment. Use{" "}
              <Link href={resendHref} className="underline underline-offset-4">
                resend verification
              </Link>{" "}
              after email delivery is enabled.
            </p>
          )}
        </div>
      ) : null}

      {/* Glass card form */}
      <div className="glass rounded-3xl border border-border/60 p-6 shadow-shell">
        <AuthForm
          mode="login"
          redirectTo={redirectTo}
          initialEmail={initialEmail}
        />
      </div>
    </section>
  );
}
