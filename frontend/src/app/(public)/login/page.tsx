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
    reason?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const redirectTo = resolvedSearchParams.next || routes.app.home;
  const initialEmail = resolvedSearchParams.email || "";
  const created = resolvedSearchParams.created === "1";
  const shouldResetSession = resolvedSearchParams.reason === "expired";

  return (
    <section className="space-y-5">
      <ResetSessionOnLoad enabled={shouldResetSession} />

      {/* Page intro */}
      <div className="space-y-1 px-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm leading-6 text-muted">
          Log in to manage your personas, access controls, and permissioned
          connections.
        </p>
      </div>

      {/* Banners */}
      {shouldResetSession ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="font-mono text-sm text-amber-600 dark:text-amber-400">
            Your session expired. Please log in again.
          </p>
        </div>
      ) : null}
      {created ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
            Account created successfully. Log in to continue.
          </p>
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
