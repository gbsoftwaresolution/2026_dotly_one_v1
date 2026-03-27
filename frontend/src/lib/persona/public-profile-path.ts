function normalizeFallbackSlug(value: string): string {
  return value.trim().toLowerCase();
}

function extractPublicSlug(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  if (segments[0] === "u" && segments[1]) {
    return normalizeFallbackSlug(segments[1]);
  }

  return normalizeFallbackSlug(segments[0]);
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
  fallbackPublicIdentifier: string,
): string {
  const parsedUrl = toUrlCandidate(publicUrl);
  const pathSlug = parsedUrl ? extractPublicSlug(parsedUrl.pathname) : null;

  return normalizeFallbackSlug(pathSlug ?? fallbackPublicIdentifier);
}

export function getCanonicalPublicProfilePath(
  publicUrl: string,
  fallbackPublicIdentifier: string,
): string {
  return `/u/${encodeURIComponent(
    getCanonicalPublicSlug(publicUrl, fallbackPublicIdentifier),
  )}`;
}

export function getCanonicalPublicLinksPath(
  publicUrl: string,
  fallbackPublicIdentifier: string,
): string {
  return `${getCanonicalPublicProfilePath(publicUrl, fallbackPublicIdentifier)}/links`;
}