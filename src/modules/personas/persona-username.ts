export const PERSONA_USERNAME_MIN_LENGTH = 3;
export const PERSONA_USERNAME_MAX_LENGTH = 30;
export const PERSONA_USERNAME_PATTERN = /^[a-z0-9_-]+$/;

export function normalizePersonaUsername(value: unknown): unknown {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}
