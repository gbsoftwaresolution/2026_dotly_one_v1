import { Transform } from "class-transformer";

export const IDENTITY_DISPLAY_NAME_MAX_LENGTH = 160;
export const IDENTITY_HANDLE_MAX_LENGTH = 80;
export const IDENTITY_NOTE_MAX_LENGTH = 500;
export const IDENTITY_REASON_MAX_LENGTH = 280;
export const IDENTITY_STATUS_MAX_LENGTH = 64;
export const IDENTITY_VERIFICATION_LEVEL_MAX_LENGTH = 64;
export const PERMISSION_KEY_MAX_LENGTH = 120;

export function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export function trimNullableString(value: unknown): unknown {
  if (value === null || typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function trimNullableLowercaseString(value: unknown): unknown {
  if (value === null || typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim().toLowerCase();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function TrimString() {
  return Transform(({ value }) => trimString(value));
}

export function TrimNullableString() {
  return Transform(({ value }) => trimNullableString(value));
}

export function TrimNullableLowercaseString() {
  return Transform(({ value }) => trimNullableLowercaseString(value));
}
