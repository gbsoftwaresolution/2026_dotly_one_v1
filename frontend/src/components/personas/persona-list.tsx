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
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-[32px] bg-white dark:bg-[#151515] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
        <h2 className="text-[22px] font-bold tracking-tight text-foreground mb-2">
          No personas yet
        </h2>
        <p className="text-[16px] text-foreground/50 max-w-sm mb-8">
          Create your first persona to start sharing your identity.
        </p>
        <Link
          href={routes.app.createPersona}
          className="group inline-flex h-[44px] items-center justify-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-semibold text-background transition-transform duration-300 hover:scale-105 active:scale-95 shadow-[0_8px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_16px_rgba(255,255,255,0.1)]"
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-24">
      {sortedPersonas.map((persona) => (
        <PersonaCard key={persona.id} persona={persona} />
      ))}
    </div>
  );
}
