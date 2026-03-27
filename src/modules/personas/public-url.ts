const DEFAULT_PUBLIC_PROFILE_HOST = "https://dotly.id";

export function normalizePublicSlug(value: string): string {
  return value.trim().toLowerCase();
}

function toUrlCandidate(publicUrl: string): URL | null {
  const trimmedPublicUrl = publicUrl.trim();

  if (!trimmedPublicUrl) {
    return null;
  }

  try {
    return new URL(trimmedPublicUrl);
  } catch {
    try {
      return new URL(`https://${trimmedPublicUrl.replace(/^\/+/, "")}`);
    } catch {
      return null;
    }
  }
}

function buildCanonicalPathname(pathname: string, slug: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const usesScopedPublicPath = segments[0] === "u";

  if (usesScopedPublicPath) {
    return `/u/${encodeURIComponent(slug)}`;
  }

  return `/${encodeURIComponent(slug)}`;
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
  const slug = resolveCanonicalPublicSlug({
    username,
    handle,
  });
  const parsedUrl = toUrlCandidate(publicUrl);

  if (parsedUrl) {
    return `${parsedUrl.origin}${buildCanonicalPathname(parsedUrl.pathname, slug)}`;
  }

  return buildPublicUrl(slug);
}