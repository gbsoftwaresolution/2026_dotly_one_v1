import { ResetSessionOnLoad } from "@/components/auth/reset-session-on-load";
import { AuthForm } from "@/components/forms/auth-form";
import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
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
      <PageHeader
        title="Login"
        description="Log in to manage your personas and the public profiles you publish."
      />
      <Card className="space-y-5">
        {shouldResetSession ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Your session expired. Please log in again.
          </p>
        ) : null}
        {created ? (
          <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Account created successfully. Log in to continue.
          </p>
        ) : null}
        <AuthForm
          mode="login"
          redirectTo={redirectTo}
          initialEmail={initialEmail}
        />
      </Card>
    </section>
  );
}
