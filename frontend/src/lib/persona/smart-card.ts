import type {
  PersonaSmartCardActionLinks,
  PersonaSmartCardActionState,
  PersonaSmartCardConfig,
  PersonaSmartCardPrimaryAction,
  PublicProfileSmartCard,
  PublicProfile,
} from "@/types/persona";

const supportedPrimaryActions = new Set<PersonaSmartCardPrimaryAction>([
  "request_access",
  "instant_connect",
  "contact_me",
]);

type SmartCardPrimaryActionAvailability = Record<
  PersonaSmartCardPrimaryAction,
  boolean
>;

interface ResolvePublicSmartCardPrimaryActionOptions {
  instantConnectUrl?: string | null;
  actionState?: PersonaSmartCardActionState | null;
  hasDirectActions?: boolean;
}

type PublicSmartCardActionProfile = Pick<
  PublicProfile,
  "channels" | "publicActions"
> & {
  smartCard: PublicProfileSmartCard | PersonaSmartCardConfig | null;
};

type PublicSmartCardDirectAction = "call" | "whatsapp" | "email" | "vcard";

const directActionOrder: PublicSmartCardDirectAction[] = [
  "call",
  "whatsapp",
  "email",
  "vcard",
];

function hasActionLinks(
  config: PersonaSmartCardConfig | PublicProfileSmartCard,
): config is PublicProfileSmartCard {
  return "actionLinks" in config;
}

function isRenderableActionLink(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRenderableDirectActionLink(
  action: PublicSmartCardDirectAction,
  value: string | null | undefined,
): value is string {
  if (!isRenderableActionLink(value)) {
    return false;
  }

  if (action !== "vcard") {
    return true;
  }

  try {
    const resolvedUrl = new URL(value, "https://dotly.local");

    return (
      resolvedUrl.protocol === "http:" || resolvedUrl.protocol === "https:"
    );
  } catch {
    return false;
  }
}

export interface ResolvedPublicSmartCardPrimaryCta {
  requestedAction: PersonaSmartCardPrimaryAction;
  action: PersonaSmartCardPrimaryAction;
  helperText: string;
  isFallback: boolean;
  isDisabled: boolean;
}

function getActionHelperText(
  action: PersonaSmartCardPrimaryAction,
  isDisabled: boolean,
): string {
  if (isDisabled) {
    switch (action) {
      case "request_access":
        return "Request unavailable";
      case "instant_connect":
        return "Instant connection unavailable";
      case "contact_me":
        return "Direct contact unavailable";
    }
  }

  switch (action) {
    case "request_access":
      return "Request required";
    case "instant_connect":
      return "Instant connection available";
    case "contact_me":
      return "Direct contact available";
  }
}

function getPrimaryActionAvailability(
  options?: ResolvePublicSmartCardPrimaryActionOptions,
): SmartCardPrimaryActionAvailability {
  const requestAccessEnabled =
    options?.actionState?.requestAccessEnabled ?? true;
  const instantConnectEnabled =
    (options?.actionState?.instantConnectEnabled ?? true) &&
    Boolean(options?.instantConnectUrl);
  const contactMeEnabled =
    (options?.actionState?.contactMeEnabled ?? true) &&
    (options?.hasDirectActions ?? true);

  return {
    request_access: requestAccessEnabled,
    instant_connect: instantConnectEnabled,
    contact_me: contactMeEnabled,
  };
}

export function getPublicSmartCardDirectActions(
  config: PersonaSmartCardConfig | PublicProfileSmartCard | null | undefined,
  _profile: PublicSmartCardActionProfile,
): PublicSmartCardDirectAction[] {
  if (!config) {
    return [];
  }

  if (!hasActionLinks(config)) {
    return [];
  }

  return directActionOrder.filter((action) =>
    isRenderableDirectActionLink(action, config.actionLinks[action]),
  );
}

export function hasPublicSmartCardDirectActions(
  profile: PublicSmartCardActionProfile,
): boolean {
  return getPublicSmartCardDirectActions(profile.smartCard, profile).length > 0;
}

export function getPublicSmartCardActionLinks(
  smartCard: PublicProfileSmartCard | PersonaSmartCardConfig | null | undefined,
): PersonaSmartCardActionLinks | null {
  if (!smartCard || !hasActionLinks(smartCard)) {
    return null;
  }

  return smartCard.actionLinks;
}

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

export function resolvePublicSmartCardPrimaryCta(
  value: unknown,
  options?: ResolvePublicSmartCardPrimaryActionOptions,
): ResolvedPublicSmartCardPrimaryCta {
  const requestedAction = normalizeSmartCardPrimaryAction(value);
  const availability = getPrimaryActionAvailability(options);

  if (availability[requestedAction]) {
    return {
      requestedAction,
      action: requestedAction,
      helperText: getActionHelperText(requestedAction, false),
      isFallback: false,
      isDisabled: false,
    };
  }

  if (availability.request_access) {
    return {
      requestedAction,
      action: "request_access",
      helperText: getActionHelperText("request_access", false),
      isFallback: requestedAction !== "request_access",
      isDisabled: false,
    };
  }

  return {
    requestedAction,
    action: requestedAction,
    helperText: getActionHelperText(requestedAction, true),
    isFallback: false,
    isDisabled: true,
  };
}

export function resolvePublicSmartCardPrimaryAction(
  value: unknown,
  options?: ResolvePublicSmartCardPrimaryActionOptions,
): PersonaSmartCardPrimaryAction {
  return resolvePublicSmartCardPrimaryCta(value, options).action;
}