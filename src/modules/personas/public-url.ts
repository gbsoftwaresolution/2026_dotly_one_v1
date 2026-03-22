const DEFAULT_PUBLIC_PROFILE_HOST = "https://dotly.id";

export function buildPublicUrl(username: string): string {
  return `${DEFAULT_PUBLIC_PROFILE_HOST}/${username}`;
}

export function canonicalizePublicUrl(
  publicUrl: string,
  username: string,
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

  return buildPublicUrl(username);
}