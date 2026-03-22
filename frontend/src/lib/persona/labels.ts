import type {
  PersonaAccessMode,
  PersonaSharingMode,
  PersonaSmartCardPrimaryAction,
  PersonaType,
} from "@/types/persona";
import { dotlyPositioning } from "@/lib/constants/positioning";

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

export const personaSharingModeOptions: Array<{
  value: PersonaSharingMode;
  label: string;
  description: string;
}> = [
  {
    value: "controlled",
    label: "Controlled Mode",
    description: "Start with a request before direct contact details are shared",
  },
  {
    value: "smart_card",
    label: "Smart Card Mode",
    description: "Lead with one clear action and optional contact buttons",
  },
];

export const personaSmartCardPrimaryActionOptions: Array<{
  value: PersonaSmartCardPrimaryAction;
  label: string;
}> = [
  { value: "request_access", label: "Request Access" },
  { value: "instant_connect", label: "Instant Connect" },
  { value: "contact_me", label: "Contact Me" },
];

export function formatAccessMode(accessMode: PersonaAccessMode): string {
  return (
    personaAccessModeOptions.find((option) => option.value === accessMode)
      ?.label || accessMode
  );
}

export function formatSharingMode(sharingMode: PersonaSharingMode): string {
  return (
    personaSharingModeOptions.find((option) => option.value === sharingMode)
      ?.label || sharingMode
  );
}

export function formatPrimaryAction(
  primaryAction: PersonaSmartCardPrimaryAction,
): string {
  return (
    personaSmartCardPrimaryActionOptions.find(
      (option) => option.value === primaryAction,
    )?.label || primaryAction
  );
}
