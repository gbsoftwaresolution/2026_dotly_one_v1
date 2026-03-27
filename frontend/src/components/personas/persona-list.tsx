import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { routes } from "@/lib/constants/routes";
import { PersonaCard } from "./persona-card";
import type { PersonaSummary } from "@/types/persona";

interface PersonaListProps {
  personas: PersonaSummary[];
}

export function PersonaList({ personas }: PersonaListProps) {
  if (personas.length === 0) {
    return (
      <div className="rounded-[2rem] bg-white/40 p-6 backdrop-blur-[40px] saturate-[200%] shadow-sm ring-1 ring-black/5 dark:bg-zinc-900/40 dark:ring-white/10 sm:p-8 relative overflow-hidden">
        <div className="absolute -inset-1/2 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent blur-3xl rounded-full opacity-50 pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <EmptyState
            title="Create your first contact identity"
            description="Start with one clear persona for the next introduction. Dotly will prepare the share QR right after you save it."
            action={
              <Link href={routes.app.createPersona}>
                <PrimaryButton fullWidth>Create first persona</PrimaryButton>
              </Link>
            }
          />
          <div className="mx-auto flex max-w-[360px] flex-col gap-2 sm:flex-row">
            <Link className="sm:flex-1" href={routes.app.createPersona}>
              <SecondaryButton className="w-full">Start setup</SecondaryButton>
            </Link>
            <Link className="sm:flex-1" href={routes.app.home}>
              <SecondaryButton className="w-full">Back to home</SecondaryButton>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {personas.map((persona) => (
        <PersonaCard key={persona.id} persona={persona} />
      ))}
    </div>
  );
}
