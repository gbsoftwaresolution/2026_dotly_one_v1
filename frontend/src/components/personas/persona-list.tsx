import { EmptyState } from "@/components/shared/empty-state";
import { dotlyPositioning } from "@/lib/constants/positioning";
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
        <div className="relative z-10">
          <EmptyState
            title="No personas yet"
            description={dotlyPositioning.app.noPersonas}
          />
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
