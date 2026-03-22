import { BadRequestException } from "@nestjs/common";
import { PersonaSharingMode as PrismaPersonaSharingMode } from "@prisma/client";

import { PersonaSharingMode } from "../../common/enums/persona-sharing-mode.enum";
import { PersonaSmartCardPrimaryAction } from "../../common/enums/persona-smart-card-primary-action.enum";

export interface PersonaSmartCardConfig {
  primaryAction: PersonaSmartCardPrimaryAction;
  allowCall: boolean;
  allowWhatsapp: boolean;
  allowEmail: boolean;
  allowVcard: boolean;
}

const prismaSharingModeMap: Record<PersonaSharingMode, PrismaPersonaSharingMode> = {
  [PersonaSharingMode.Controlled]: PrismaPersonaSharingMode.CONTROLLED,
  [PersonaSharingMode.SmartCard]: PrismaPersonaSharingMode.SMART_CARD,
};

const apiSharingModeMap: Record<PrismaPersonaSharingMode, PersonaSharingMode> = {
  [PrismaPersonaSharingMode.CONTROLLED]: PersonaSharingMode.Controlled,
  [PrismaPersonaSharingMode.SMART_CARD]: PersonaSharingMode.SmartCard,
};

const allowedPrimaryActions = new Set<string>([
  PersonaSmartCardPrimaryAction.RequestAccess,
  PersonaSmartCardPrimaryAction.InstantConnect,
  PersonaSmartCardPrimaryAction.ContactMe,
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBoolean(
  value: unknown,
  fieldName: keyof Omit<PersonaSmartCardConfig, "primaryAction">,
): boolean {
  if (value === undefined) {
    return false;
  }

  if (typeof value !== "boolean") {
    throw new BadRequestException(
      `smartCardConfig.${fieldName} must be a boolean`,
    );
  }

  return value;
}

export function toPrismaSharingMode(
  sharingMode: PersonaSharingMode,
): PrismaPersonaSharingMode {
  return prismaSharingModeMap[sharingMode];
}

export function toApiSharingMode(
  sharingMode: PrismaPersonaSharingMode,
): PersonaSharingMode {
  return apiSharingModeMap[sharingMode];
}

export function validateSmartCardConfig(value: unknown): PersonaSmartCardConfig {
  if (!isPlainObject(value)) {
    throw new BadRequestException("smartCardConfig must be an object");
  }

  if (!allowedPrimaryActions.has(String(value.primaryAction))) {
    throw new BadRequestException(
      "smartCardConfig.primaryAction must be a valid enum value",
    );
  }

  return {
    primaryAction: value.primaryAction as PersonaSmartCardPrimaryAction,
    allowCall: normalizeBoolean(value.allowCall, "allowCall"),
    allowWhatsapp: normalizeBoolean(value.allowWhatsapp, "allowWhatsapp"),
    allowEmail: normalizeBoolean(value.allowEmail, "allowEmail"),
    allowVcard: normalizeBoolean(value.allowVcard, "allowVcard"),
  };
}

export function toSafeSmartCardConfig(
  value: unknown,
): PersonaSmartCardConfig | null {
  try {
    if (value === null || value === undefined) {
      return null;
    }

    return validateSmartCardConfig(value);
  } catch {
    return null;
  }
}

export function supportsRequestAccessFlow(
  sharingMode: PrismaPersonaSharingMode,
  smartCardConfig: unknown,
): boolean {
  if (sharingMode === PrismaPersonaSharingMode.CONTROLLED) {
    return true;
  }

  const safeSmartCardConfig = toSafeSmartCardConfig(smartCardConfig);

  return (
    safeSmartCardConfig?.primaryAction ===
    PersonaSmartCardPrimaryAction.RequestAccess
  );
}