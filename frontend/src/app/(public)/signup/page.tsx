import { AuthForm } from "@/components/forms/auth-form";
import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
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
      <PageHeader
        title="Sign up"
        description="Create your Dotly account to manage personas and share permissioned identity cards safely."
      />
      <Card className="space-y-5">
        <AuthForm mode="signup" redirectTo={redirectTo} />
      </Card>
    </section>
  );
}
