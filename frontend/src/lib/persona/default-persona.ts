import type { PersonaSummary } from "@/types/persona";

export function resolvePreferredPersonaId(
  personas: PersonaSummary[],
  preferredPersonaId?: string | null,
): string {
  if (!personas.length) {
    return "";
  }

  if (
    preferredPersonaId &&
    personas.some((persona) => persona.id === preferredPersonaId)
  ) {
    return preferredPersonaId;
  }

  return personas[0]?.id ?? "";
}
