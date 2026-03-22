import { BadRequestException } from "@nestjs/common";
import {
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaSharingMode as PrismaPersonaSharingMode,
} from "@prisma/client";

import { PersonaSharingMode } from "../../common/enums/persona-sharing-mode.enum";
import { PersonaSmartCardPrimaryAction } from "../../common/enums/persona-smart-card-primary-action.enum";

export interface PersonaSmartCardConfig {
  primaryAction: PersonaSmartCardPrimaryAction;
  allowCall: boolean;
  allowWhatsapp: boolean;
  allowEmail: boolean;
  allowVcard: boolean;
}

export interface PersonaPublicActionFields {
  publicPhone: string | null;
  publicWhatsappNumber: string | null;
  publicEmail: string | null;
}

export interface PersonaSmartCardActions {
  call: boolean;
  whatsapp: boolean;
  email: boolean;
  vcard: boolean;
}

export interface PersonaPublicActionValues {
  phone: string | null;
  whatsappNumber: string | null;
  email: string | null;
}

export interface PersonaSmartCardActionSource extends PersonaPublicActionFields {
  smartCardConfig: unknown;
}

export interface PersonaSmartCardActionState {
  requestAccessEnabled: boolean;
  instantConnectEnabled: boolean;
  contactMeEnabled: boolean;
}

export interface PersonaSmartCardCompatibilityContext {
  sharingMode: PrismaPersonaSharingMode;
  accessMode: PrismaPersonaAccessMode;
  hasActiveProfileQr?: boolean;
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

function hasPublicValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPhoneLikeValue(value: string): boolean {
  const trimmedValue = value.trim();

  if (!/^[0-9+().\-\s]{7,32}$/.test(trimmedValue)) {
    return false;
  }

  const digits = trimmedValue.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
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

export function isRequestAccessEnabled(
  persona: Pick<
    PersonaSmartCardCompatibilityContext,
    "sharingMode" | "accessMode"
  >,
): boolean {
  return (
    persona.sharingMode === PrismaPersonaSharingMode.SMART_CARD &&
    persona.accessMode !== PrismaPersonaAccessMode.PRIVATE
  );
}

export function isInstantConnectEnabled(
  persona: PersonaSmartCardCompatibilityContext,
): boolean {
  return (
    persona.sharingMode === PrismaPersonaSharingMode.SMART_CARD &&
    persona.accessMode !== PrismaPersonaAccessMode.PRIVATE &&
    persona.hasActiveProfileQr === true
  );
}

export function isContactMeEnabled(
  config: PersonaSmartCardConfig | null | undefined,
  publicFields?: Partial<PersonaPublicActionFields> | null,
): boolean {
  return hasDirectSmartCardActions({
    smartCardConfig: config,
    publicPhone: publicFields?.publicPhone ?? null,
    publicWhatsappNumber: publicFields?.publicWhatsappNumber ?? null,
    publicEmail: publicFields?.publicEmail ?? null,
  });
}

export function isCallEnabled(persona: PersonaSmartCardActionSource): boolean {
  const config = toSafeSmartCardConfig(persona.smartCardConfig);

  return Boolean(config?.allowCall && hasPublicValue(persona.publicPhone));
}

export function isWhatsappEnabled(
  persona: PersonaSmartCardActionSource,
): boolean {
  const config = toSafeSmartCardConfig(persona.smartCardConfig);

  return Boolean(
    config?.allowWhatsapp && hasPublicValue(persona.publicWhatsappNumber),
  );
}

export function isEmailEnabled(persona: PersonaSmartCardActionSource): boolean {
  const config = toSafeSmartCardConfig(persona.smartCardConfig);

  return Boolean(config?.allowEmail && hasPublicValue(persona.publicEmail));
}

export function isVcardEnabled(persona: PersonaSmartCardActionSource): boolean {
  const config = toSafeSmartCardConfig(persona.smartCardConfig);

  return Boolean(config?.allowVcard);
}

export function buildSmartCardActions(
  persona: PersonaSmartCardActionSource,
): PersonaSmartCardActions {
  return {
    call: isCallEnabled(persona),
    whatsapp: isWhatsappEnabled(persona),
    email: isEmailEnabled(persona),
    vcard: isVcardEnabled(persona),
  };
}

export function hasDirectSmartCardActions(
  persona: PersonaSmartCardActionSource,
): boolean {
  const actions = buildSmartCardActions(persona);

  return actions.call || actions.whatsapp || actions.email || actions.vcard;
}

export function buildSafePublicActionValues(
  persona: PersonaSmartCardActionSource,
): PersonaPublicActionValues {
  return {
    phone: isCallEnabled(persona) ? persona.publicPhone : null,
    whatsappNumber: isWhatsappEnabled(persona)
      ? persona.publicWhatsappNumber
      : null,
    email: isEmailEnabled(persona) ? persona.publicEmail : null,
  };
}

export function buildSmartCardActionState(
  persona: PersonaSmartCardCompatibilityContext,
  config: PersonaSmartCardConfig | null | undefined,
  publicFields?: Partial<PersonaPublicActionFields> | null,
): PersonaSmartCardActionState {
  return {
    requestAccessEnabled: isRequestAccessEnabled(persona),
    instantConnectEnabled: isInstantConnectEnabled(persona),
    contactMeEnabled: hasDirectSmartCardActions({
      smartCardConfig: config,
      publicPhone: publicFields?.publicPhone ?? null,
      publicWhatsappNumber: publicFields?.publicWhatsappNumber ?? null,
      publicEmail: publicFields?.publicEmail ?? null,
    }),
  };
}

export function validateSmartCardConfigCompatibility(
  config: PersonaSmartCardConfig,
  context: PersonaSmartCardCompatibilityContext,
  publicFields?: Partial<PersonaPublicActionFields> | null,
): PersonaSmartCardConfig {
  if (
    config.primaryAction === PersonaSmartCardPrimaryAction.RequestAccess &&
    !isRequestAccessEnabled(context)
  ) {
    throw new BadRequestException(
      "smartCardConfig.primaryAction request_access is not supported for private personas",
    );
  }


  const actionSource: PersonaSmartCardActionSource = {
    smartCardConfig: config,
    publicPhone: publicFields?.publicPhone ?? null,
    publicWhatsappNumber: publicFields?.publicWhatsappNumber ?? null,
    publicEmail: publicFields?.publicEmail ?? null,
  };

  if (config.allowCall && !isCallEnabled(actionSource)) {
    throw new BadRequestException(
      "smartCardConfig.allowCall requires a valid publicPhone value",
    );
  }

  if (config.allowWhatsapp && !isWhatsappEnabled(actionSource)) {
    throw new BadRequestException(
      "smartCardConfig.allowWhatsapp requires a valid publicWhatsappNumber value",
    );
  }

  if (config.allowEmail && !isEmailEnabled(actionSource)) {
    throw new BadRequestException(
      "smartCardConfig.allowEmail requires a valid publicEmail value",
    );
  }

  if (
    config.primaryAction === PersonaSmartCardPrimaryAction.InstantConnect &&
    !isInstantConnectEnabled(context)
  ) {
    throw new BadRequestException(
      context.accessMode === PrismaPersonaAccessMode.PRIVATE
        ? "smartCardConfig.primaryAction instant_connect is not supported for private personas"
        : "smartCardConfig.primaryAction instant_connect requires an active profile QR",
    );
  }

  if (
    config.primaryAction === PersonaSmartCardPrimaryAction.ContactMe &&
    !hasDirectSmartCardActions(actionSource)
  ) {
    throw new BadRequestException(
      "smartCardConfig.primaryAction contact_me requires at least one direct action to be enabled",
    );
  }

  return config;
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
  options?: {
    hasActiveProfileQr?: boolean;
  },
): boolean {
  if (sharingMode === PrismaPersonaSharingMode.CONTROLLED) {
    return true;
  }

  const safeSmartCardConfig = toSafeSmartCardConfig(smartCardConfig);

  if (safeSmartCardConfig === null) {
    return false;
  }

  if (
    safeSmartCardConfig.primaryAction ===
      PersonaSmartCardPrimaryAction.InstantConnect &&
    options?.hasActiveProfileQr === false
  ) {
    return true;
  }

  return (
    safeSmartCardConfig.primaryAction === PersonaSmartCardPrimaryAction.RequestAccess
  );
}