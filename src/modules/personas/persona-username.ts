export const PERSONA_USERNAME_MIN_LENGTH = 3;
export const PERSONA_USERNAME_STANDARD_MIN_LENGTH = 6;
export const PERSONA_USERNAME_MAX_LENGTH = 30;
export const PERSONA_USERNAME_PATTERN = /^[a-z0-9_-]+$/;

export type PersonaUsernameAvailabilityCode =
  | "available"
  | "too_short"
  | "premium_short"
  | "too_long"
  | "invalid_characters"
  | "must_start_with_letter"
  | "cannot_end_with_separator"
  | "repeated_separator"
  | "reserved_system"
  | "reserved_brand"
  | "taken";

export interface PersonaUsernameValidationResult {
  username: string;
  available: boolean;
  code: PersonaUsernameAvailabilityCode;
  message: string;
  requiresClaim: boolean;
}

const RESERVED_SYSTEM_USERNAMES = new Set([
  "about",
  "account",
  "admin",
  "api",
  "app",
  "auth",
  "billing",
  "blog",
  "contact",
  "create",
  "dashboard",
  "discover",
  "docs",
  "dotly",
  "explore",
  "help",
  "home",
  "legal",
  "login",
  "logout",
  "mail",
  "me",
  "notifications",
  "privacy",
  "q",
  "qr",
  "reset-password",
  "root",
  "security",
  "settings",
  "signup",
  "support",
  "system",
  "terms",
  "u",
  "verify-email",
  "www",
]);

const RESERVED_BRAND_TOKENS = new Set([
  "adidas",
  "airbnb",
  "amazon",
  "apple",
  "discord",
  "facebook",
  "google",
  "instagram",
  "kfc",
  "linkedin",
  "mcdonalds",
  "meta",
  "microsoft",
  "netflix",
  "nike",
  "openai",
  "samsung",
  "spotify",
  "starbucks",
  "tesla",
  "tiktok",
  "uber",
  "whatsapp",
  "youtube",
]);

export function normalizePersonaUsername(value: unknown): unknown {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

function reserve(
  code: Exclude<PersonaUsernameAvailabilityCode, "available" | "taken">,
  username: string,
  message: string,
  requiresClaim = false,
): PersonaUsernameValidationResult {
  return {
    username,
    available: false,
    code,
    message,
    requiresClaim,
  };
}

function splitPersonaUsernameSegments(username: string): string[] {
  return username.split(/[_-]+/).filter(Boolean);
}

export function isReservedBrandUsername(username: string): boolean {
  const normalizedUsername = normalizePersonaUsername(username);

  if (typeof normalizedUsername !== "string") {
    return false;
  }

  if (RESERVED_BRAND_TOKENS.has(normalizedUsername)) {
    return true;
  }

  return splitPersonaUsernameSegments(normalizedUsername).some((segment) =>
    RESERVED_BRAND_TOKENS.has(segment),
  );
}

export function validatePersonaUsernameCandidate(
  value: unknown,
): PersonaUsernameValidationResult {
  const normalizedUsername = normalizePersonaUsername(value);
  const username =
    typeof normalizedUsername === "string" ? normalizedUsername : "";

  if (username.length < PERSONA_USERNAME_MIN_LENGTH) {
    return reserve(
      "too_short",
      username,
      "Use at least 3 characters to check a username. Standard usernames require 6 or more characters.",
    );
  }

  if (username.length < PERSONA_USERNAME_STANDARD_MIN_LENGTH) {
    return reserve(
      "premium_short",
      username,
      "Usernames under 6 characters are reserved for premium claims.",
      true,
    );
  }

  if (username.length > PERSONA_USERNAME_MAX_LENGTH) {
    return reserve(
      "too_long",
      username,
      `Usernames can be up to ${PERSONA_USERNAME_MAX_LENGTH} characters long.`,
    );
  }

  if (!PERSONA_USERNAME_PATTERN.test(username)) {
    return reserve(
      "invalid_characters",
      username,
      "Use lowercase letters, numbers, hyphens, or underscores only.",
    );
  }

  if (!/^[a-z]/.test(username)) {
    return reserve(
      "must_start_with_letter",
      username,
      "Usernames must start with a letter.",
    );
  }

  if (/[_-]$/.test(username)) {
    return reserve(
      "cannot_end_with_separator",
      username,
      "Usernames cannot end with a hyphen or underscore.",
    );
  }

  if (/__|--|_-|-_/.test(username)) {
    return reserve(
      "repeated_separator",
      username,
      "Use single separators only. Avoid consecutive hyphens or underscores.",
    );
  }

  if (RESERVED_SYSTEM_USERNAMES.has(username)) {
    return reserve(
      "reserved_system",
      username,
      "This username is reserved by Dotly and cannot be claimed.",
    );
  }

  if (isReservedBrandUsername(username)) {
    return reserve(
      "reserved_brand",
      username,
      "This brand username is protected. Contact support to begin a verified brand claim.",
      true,
    );
  }

  return {
    username,
    available: true,
    code: "available",
    message: "Username is available.",
    requiresClaim: false,
  };
}
