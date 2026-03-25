import Link from "next/link";
import { redirect } from "next/navigation";

import { PersonaList } from "@/components/personas/persona-list";
import { PageHeader } from "@/components/shared/page-header";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { personaApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { requireServerSession } from "@/lib/auth/protected-route";

export default async function PersonasPage() {
  const { accessToken } = await requireServerSession("/app/personas");

  try {
    const personas = await personaApi.list(accessToken);

    return (
      <section className="space-y-5 sm:space-y-6">
        <PageHeader
          title="Personas"
          description="Manage the Dotly identities you share in real life."
          action={
            <Link href="/app/personas/create">
              <SecondaryButton className="w-full sm:w-auto">
                Create persona
              </SecondaryButton>
            </Link>
          }
        />
        <div className="premium-card rounded-[2rem] p-4 sm:rounded-3xl sm:p-6">
          <div className="mb-5 space-y-1 sm:mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Identity collection
            </p>
            <p className="text-sm leading-6 text-muted">
              Each persona gives you a distinct public presence for different
              contexts, teams, and conversations.
            </p>
          </div>
          <PersonaList personas={personas} />
        </div>
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login?next=/app/personas&reason=expired");
    }

    return (
      <section className="space-y-5 sm:space-y-6">
        <PageHeader
          title="Personas"
          description="Manage the Dotly identities you share in real life."
        />
        <div className="rounded-[2rem] bg-rose-500/5 px-5 py-5 ring-1 ring-inset ring-rose-500/20 sm:rounded-3xl sm:px-6">
          <p className="text-sm leading-6 text-rose-700 dark:text-rose-300">
            We could not load your personas right now. Refresh the page and try
            again in a moment.
          </p>
        </div>
      </section>
    );
  }
}
