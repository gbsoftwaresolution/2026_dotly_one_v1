export const PRIVATE_NOTE_MAX_LENGTH = 2000;

export function normalizePrivateNote(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();

  return normalized.length > 0 ? normalized : null;
}