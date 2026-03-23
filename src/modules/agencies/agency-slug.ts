export const AGENCY_SLUG_MAX_LENGTH = 80;
export const AGENCY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeAgencySlug(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return slugifyAgencySegment(value);
}

export function slugifyAgencySegment(value: string): string {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalizedValue.length === 0) {
    return "";
  }

  return normalizedValue
    .slice(0, AGENCY_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "")
    .replace(/^-+/g, "");
}
