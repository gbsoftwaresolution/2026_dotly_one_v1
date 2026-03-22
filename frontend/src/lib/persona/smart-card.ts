import type { PersonaSmartCardPrimaryAction } from "@/types/persona";

const supportedPrimaryActions = new Set<PersonaSmartCardPrimaryAction>([
  "request_access",
  "instant_connect",
  "contact_me",
]);

export function normalizeSmartCardPrimaryAction(
  value: unknown,
): PersonaSmartCardPrimaryAction {
  if (
    typeof value === "string" &&
    supportedPrimaryActions.has(value as PersonaSmartCardPrimaryAction)
  ) {
    return value as PersonaSmartCardPrimaryAction;
  }

  return "request_access";
}

export function resolvePublicSmartCardPrimaryAction(
  value: unknown,
  options?: {
    instantConnectUrl?: string | null;
  },
): PersonaSmartCardPrimaryAction {
  const normalized = normalizeSmartCardPrimaryAction(value);

  if (normalized === "instant_connect" && !options?.instantConnectUrl) {
    return "request_access";
  }

  return normalized;
}