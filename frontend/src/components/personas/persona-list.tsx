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
      <EmptyState
        title="No personas yet"
        description={dotlyPositioning.app.noPersonas}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {personas.map((persona) => (
        <PersonaCard key={persona.id} persona={persona} />
      ))}
    </div>
  );
}
