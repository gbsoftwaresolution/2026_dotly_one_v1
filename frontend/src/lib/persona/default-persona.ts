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

  const primaryPersona = personas.find(
    (persona) => "isPrimary" in persona && persona.isPrimary === true,
  );

  if (primaryPersona) {
    return primaryPersona.id;
  }

  return personas[0]?.id ?? "";
}
