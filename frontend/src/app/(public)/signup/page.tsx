import { AuthForm } from "@/components/forms/auth-form";
import { routes } from "@/lib/constants/routes";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const redirectTo = resolvedSearchParams.next || routes.app.home;

  return (
    <section className="space-y-5">
      {/* Page intro */}
      <div className="space-y-1 px-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="text-sm leading-6 text-muted">
          Join Dotly to manage personas and share permissioned identity cards
          safely.
        </p>
      </div>

      {/* Glass card form */}
      <div className="glass rounded-3xl border border-border/60 p-6 shadow-shell">
        <AuthForm mode="signup" redirectTo={redirectTo} />
      </div>
    </section>
  );
}
