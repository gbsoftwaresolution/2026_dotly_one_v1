import Link from "next/link";

import { LogoutButton } from "@/components/app-shell/logout-button";
import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { requireServerSession } from "@/lib/auth/protected-route";

export default async function AppHomePage() {
  const { user } = await requireServerSession("/app");

  return (
    <section className="space-y-4">
      <PageHeader
        title="Home"
        description="Your private workspace for managing Dotly identities."
      />
      <Card className="space-y-5 shadow-shell">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">
            Account
          </p>
          <h2 className="text-2xl font-semibold text-foreground">
            Logged in as {user.email}
          </h2>
          <p className="text-sm leading-6 text-muted">
            Create personas, control who can discover them, and decide which
            identity should be public.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/app/personas" className="w-full sm:w-auto">
            <SecondaryButton className="w-full">Go to personas</SecondaryButton>
          </Link>
          <Link href="/app/requests" className="w-full sm:w-auto">
            <SecondaryButton className="w-full">Open requests</SecondaryButton>
          </Link>
          <div className="w-full sm:w-auto">
            <LogoutButton />
          </div>
        </div>
      </Card>
    </section>
  );
}
