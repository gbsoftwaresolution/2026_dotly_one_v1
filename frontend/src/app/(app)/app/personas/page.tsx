import Link from "next/link";
import { redirect } from "next/navigation";

import { PersonaList } from "@/components/personas/persona-list";
import { PageHeader } from "@/components/shared/page-header";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { personaApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function PersonasPage() {
  const { accessToken } = await requireServerSession(routes.app.personas);

  try {
    const personas = await personaApi.list(accessToken);

    return (
      <section className="space-y-5 sm:space-y-6">
        <PageHeader
          title="Personas"
          description="Shape the Dotly identities you use to lead first exchanges with clarity, trust, and curated access."
          action={
            <Link href={routes.app.createPersona}>
              <SecondaryButton className="w-full sm:w-auto">
                Create persona
              </SecondaryButton>
            </Link>
          }
        />
        <div className="flex flex-col gap-4">
          <div className="mb-5 space-y-1 sm:mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Dotly collection
            </p>
            <p className="text-sm leading-6 text-muted">
              Each persona gives you a distinct premium contact identity for
              different rooms, relationships, and kinds of follow-through.
            </p>
          </div>
          <PersonaList personas={personas} />
        </div>
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(
        `/login?next=${encodeURIComponent(routes.app.personas)}&reason=expired`,
      );
    }

    return (
      <section className="space-y-5 sm:space-y-6">
        <PageHeader
          title="Personas"
          description="Shape the Dotly identities you use to lead first exchanges with clarity, trust, and curated access."
        />
        <div className="rounded-[2rem] bg-white/40 px-5 py-6 backdrop-blur-[40px] saturate-[200%] shadow-sm ring-1 ring-rose-500/20 dark:bg-zinc-900/40 sm:p-8 relative overflow-hidden">
          <div className="absolute -inset-1/2 bg-gradient-to-br from-rose-500/10 via-red-500/10 to-transparent blur-3xl rounded-full opacity-50 pointer-events-none" />
          <p className="relative z-10 text-sm leading-6 text-rose-700 dark:text-rose-300">
            We could not load your personas right now. Refresh the page and try
            again in a moment.
          </p>
        </div>
      </section>
    );
  }
}
