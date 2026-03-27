import Link from "next/link";
import { Users, Plus } from "lucide-react";

import { routes } from "@/lib/constants/routes";
import { PersonaCard } from "./persona-card";
import type { PersonaSummary } from "@/types/persona";

interface PersonaListProps {
  personas: PersonaSummary[];
}

export function PersonaList({ personas }: PersonaListProps) {
  if (personas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center rounded-[2.5rem] bg-white/50 ring-1 ring-inset ring-black/5 backdrop-blur-[40px] saturate-[150%] dark:bg-white/[0.02] dark:ring-white/10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.3)]">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-black/5 to-black/10 dark:from-white/10 dark:to-white/5 mb-6 ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-inner">
          <Users className="h-10 w-10 text-foreground/40" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground mb-3">
          No personas yet
        </h2>
        <p className="text-[16px] text-foreground/50 max-w-md mb-8 font-medium">
          Create your first persona to start sharing your identity and
          connecting with others seamlessly.
        </p>
        <Link
          href={routes.app.createPersona}
          className="group inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-foreground px-8 text-[16px] font-semibold text-background transition-transform duration-300 hover:scale-105 active:scale-95 shadow-[0_8px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_16px_rgba(255,255,255,0.1)]"
        >
          <Plus className="h-5 w-5" />
          Create Persona
        </Link>
      </div>
    );
  }

  // Sort primary to the top
  const sortedPersonas = [...personas].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return 0;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-24">
      {sortedPersonas.map((persona) => (
        <PersonaCard key={persona.id} persona={persona} />
      ))}
    </div>
  );
}
