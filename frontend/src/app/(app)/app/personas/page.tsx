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
      <section className="relative w-full flex flex-col items-center min-h-[calc(100dvh-8rem)]">
        {/* Immersive Ambient Background (Apple Style) */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
          <div className="absolute top-[-20%] left-[-10%] h-[70vh] w-[70vw] rounded-full bg-blue-500/10 blur-[140px] mix-blend-normal dark:mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] h-[60vh] w-[60vw] rounded-full bg-indigo-500/10 blur-[140px] mix-blend-normal dark:mix-blend-screen" />
          <div className="absolute top-[20%] right-[10%] h-[40vh] w-[40vw] rounded-full bg-purple-500/5 blur-[120px] mix-blend-normal dark:mix-blend-screen" />
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[100px]" />
        </div>

        <div className="w-full max-w-5xl px-5 py-10 md:py-16 space-y-12">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
            <div className="space-y-3">
              <h1 className="text-[40px] md:text-[48px] font-bold tracking-tight text-foreground leading-none">
                Personas
              </h1>
              <p className="text-[17px] font-medium text-foreground/50 max-w-xl leading-relaxed">
                Manage the identities you use to lead first exchanges with
                clarity, intention, and trust.
              </p>
            </div>

            <Link
              href={routes.app.createPersona}
              className="group inline-flex h-[48px] shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-semibold text-background transition-all duration-300 ease-out hover:scale-105 active:scale-95 shadow-[0_8px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_16px_rgba(255,255,255,0.1)]"
            >
              <Plus className="h-[20px] w-[20px]" />
              Create Persona
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
      <section className="relative w-full overflow-hidden flex flex-col items-center min-h-[calc(100dvh-8rem)]">
        <div className="w-full max-w-5xl px-5 py-10 md:py-16 space-y-12">
          <h1 className="text-[40px] md:text-[48px] font-bold tracking-tight text-foreground leading-none">
            Personas
          </h1>
          <div className="rounded-[2.5rem] bg-rose-500/10 px-8 py-12 ring-1 ring-inset ring-rose-500/20 backdrop-blur-3xl text-center shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)]">
            <p className="text-[17px] font-medium text-rose-700 dark:text-rose-300">
              We could not load your personas right now. Refresh the page and
              try again in a moment.
            </p>
          </div>
        </div>
      </section>
    );
  }
}
