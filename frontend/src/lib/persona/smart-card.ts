import type {
  PersonaSmartCardActionLinks,
  PersonaSmartCardActionState,
  PersonaSmartCardPrimaryAction,
  PublicProfileSmartCard,
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

type PublicSmartCardActionProfile = {
  smartCard: PublicProfileSmartCard | null;
};

type PublicSmartCardDirectAction = "call" | "whatsapp" | "email" | "vcard";

const directActionOrder: PublicSmartCardDirectAction[] = [
  "call",
  "whatsapp",
  "email",
  "vcard",
];

function hasActionLinks(
  config: PublicProfileSmartCard,
): config is PublicProfileSmartCard {
  return "actionLinks" in config;
}

function isRenderableActionLink(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getRenderableDirectActionLink(
  action: PublicSmartCardDirectAction,
  value: string | null | undefined,
): string | null {
  if (!isRenderableActionLink(value)) {
    return null;
  }

  const trimmedValue = value.trim();

  try {
    const resolvedUrl = new URL(trimmedValue, "https://dotly.local");

    switch (action) {
      case "call":
        return resolvedUrl.protocol === "tel:" && resolvedUrl.pathname.length > 0
          ? trimmedValue
          : null;
      case "whatsapp":
        return resolvedUrl.protocol === "https:" &&
          resolvedUrl.hostname === "wa.me" &&
          /^\/\d+$/.test(resolvedUrl.pathname) &&
          resolvedUrl.search.length === 0 &&
          resolvedUrl.hash.length === 0
          ? trimmedValue
          : null;
      case "email":
        return resolvedUrl.protocol === "mailto:" &&
          resolvedUrl.pathname.length > 0
          ? trimmedValue
          : null;
      case "vcard":
        return resolvedUrl.protocol === "http:" ||
          resolvedUrl.protocol === "https:"
          ? trimmedValue
          : null;
    }
  } catch {
    return null;
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
  config: PublicProfileSmartCard | null | undefined,
  _profile: PublicSmartCardActionProfile,
): PublicSmartCardDirectAction[] {
  const actionLinks = getPublicSmartCardActionLinks(config);

  if (!actionLinks) {
    return [];
  }

  return directActionOrder.filter((action) =>
    actionLinks[action] !== null,
  );
}

export function hasPublicSmartCardDirectActions(
  profile: PublicSmartCardActionProfile,
): boolean {
  return getPublicSmartCardDirectActions(profile.smartCard, profile).length > 0;
}

export function getPublicSmartCardActionLinks(
  smartCard: PublicProfileSmartCard | null | undefined,
): PersonaSmartCardActionLinks | null {
  if (!smartCard || !hasActionLinks(smartCard)) {
    return null;
  }

  return {
    call: getRenderableDirectActionLink("call", smartCard.actionLinks.call),
    whatsapp: getRenderableDirectActionLink(
      "whatsapp",
      smartCard.actionLinks.whatsapp,
    ),
    email: getRenderableDirectActionLink("email", smartCard.actionLinks.email),
    vcard: getRenderableDirectActionLink("vcard", smartCard.actionLinks.vcard),
  };
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