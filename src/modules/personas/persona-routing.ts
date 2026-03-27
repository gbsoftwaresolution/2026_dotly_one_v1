export const PERSONA_ROUTING_KEY_MAX_LENGTH = 64;

export const PERSONA_ROUTING_DISPLAY_NAME_MAX_LENGTH = 160;

export const PERSONA_ROUTING_KEY_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

export function normalizePersonaRoutingKey(value: unknown): unknown {
  if (value === null || typeof value !== "string") {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function normalizePersonaRoutingDisplayName(value: unknown): unknown {
  if (value === null || typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}