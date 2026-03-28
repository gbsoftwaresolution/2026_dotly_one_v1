import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { PersonaList } from "@/components/personas/persona-list";
import { personaApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function PersonasPage() {
  const { accessToken } = await requireServerSession(routes.app.personas);

  try {
    const personas = await personaApi.list(accessToken);

    return (
      <section className="relative w-full flex flex-col items-center">
        {/* Soft immersive background for rich contrast */}
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[#F2F2F7] dark:bg-[#000000]" />

        <div className="w-full max-w-5xl space-y-6 md:space-y-10 pt-2 pb-10">
          {/* High-end Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-[40px] md:text-[48px] font-bold tracking-tight text-foreground leading-none">
                Personas
              </h1>
              <p className="text-[17px] font-medium text-foreground/50 max-w-xl">
                The identities you use to connect with the world.
              </p>
            </div>

            <Link
              href={routes.app.createPersona}
              className="group inline-flex h-[44px] shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-semibold text-background transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_8px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_16px_rgba(255,255,255,0.1)]"
            >
              <Plus className="h-[20px] w-[20px]" />
              New Persona
            </Link>
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
      <section className="relative w-full flex flex-col items-center">
        <div className="w-full max-w-5xl space-y-6 md:space-y-10 pt-2 pb-10">
          <h1 className="text-[40px] md:text-[48px] font-bold tracking-tight text-foreground leading-none">
            Personas
          </h1>
          <div className="rounded-[32px] bg-rose-500/10 px-8 py-12 ring-1 ring-inset ring-rose-500/20 text-center">
            <p className="text-[17px] font-medium text-rose-700 dark:text-rose-300">
              We could not load your personas right now. Refresh the page and
              try again.
            </p>
          </div>
        </div>
      </section>
    );
  }
}
