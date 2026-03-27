const DEFAULT_PUBLIC_PROFILE_HOST = "https://dotly.id";

export function normalizePublicSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveCanonicalPublicSlug(options: {
  username: string;
  handle?: string | null;
}): string {
  return normalizePublicSlug(options.handle ?? options.username);
}

export function buildPublicUrl(slug: string): string {
  return `${DEFAULT_PUBLIC_PROFILE_HOST}/${encodeURIComponent(
    normalizePublicSlug(slug),
  )}`;
}

export function canonicalizePublicUrl(
  publicUrl: string,
  username: string,
  handle?: string | null,
): string {
  const trimmedPublicUrl = publicUrl.trim();

  if (
    trimmedPublicUrl.startsWith("http://") ||
    trimmedPublicUrl.startsWith("https://")
  ) {
    return trimmedPublicUrl;
  }

  if (trimmedPublicUrl.length > 0) {
    return `https://${trimmedPublicUrl.replace(/^\/+/, "")}`;
  }

  return buildPublicUrl(
    resolveCanonicalPublicSlug({
      username,
      handle,
    }),
  );
}