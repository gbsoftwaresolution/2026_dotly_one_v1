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
      <div className="rounded-[1.75rem] bg-foreground/[0.02] p-5 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-6">
        <EmptyState
          title="No personas yet"
          description={dotlyPositioning.app.noPersonas}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {personas.map((persona) => (
        <PersonaCard key={persona.id} persona={persona} />
      ))}
    </div>
  );
}
