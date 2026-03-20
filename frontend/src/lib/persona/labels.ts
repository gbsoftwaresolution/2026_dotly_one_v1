import type { PersonaAccessMode, PersonaType } from "@/types/persona";

export const personaTypeOptions: Array<{
  value: PersonaType;
  label: string;
}> = [
  { value: "professional", label: "Professional" },
  { value: "personal", label: "Personal" },
  { value: "business", label: "Business" },
];

export const personaAccessModeOptions: Array<{
  value: PersonaAccessMode;
  label: string;
}> = [
  { value: "open", label: "Open" },
  { value: "request", label: "Request" },
  { value: "private", label: "Private" },
];

export function formatAccessMode(accessMode: PersonaAccessMode): string {
  return (
    personaAccessModeOptions.find((option) => option.value === accessMode)
      ?.label || accessMode
  );
}
