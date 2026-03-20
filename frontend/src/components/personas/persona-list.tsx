import { EmptyState } from "@/components/shared/empty-state";
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
        description="Create your first persona to reserve a Dotly identity and publish it when you are ready."
      />
    );
  }

  return (
    <div className="space-y-3">
      {personas.map((persona) => (
        <PersonaCard key={persona.id} persona={persona} />
      ))}
    </div>
  );
}
