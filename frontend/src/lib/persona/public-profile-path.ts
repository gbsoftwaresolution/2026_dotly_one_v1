function normalizeFallbackSlug(value: string): string {
  return value.trim().toLowerCase();
}

function toUrlCandidate(publicUrl: string): URL | null {
  const trimmed = publicUrl.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed.replace(/^\/+/, "")}`,
    );
  } catch {
    return null;
  }
}

export function getCanonicalPublicSlug(
  publicUrl: string,
  fallbackUsername: string,
): string {
  const parsedUrl = toUrlCandidate(publicUrl);
  const pathSlug = parsedUrl?.pathname.split("/").filter(Boolean)[0];

  return normalizeFallbackSlug(pathSlug ?? fallbackUsername);
}

export function getCanonicalPublicProfilePath(
  publicUrl: string,
  fallbackUsername: string,
): string {
  return `/${encodeURIComponent(
    getCanonicalPublicSlug(publicUrl, fallbackUsername),
  )}`;
}

export function getCanonicalPublicLinksPath(
  publicUrl: string,
  fallbackUsername: string,
): string {
  return `${getCanonicalPublicProfilePath(publicUrl, fallbackUsername)}/links`;
}