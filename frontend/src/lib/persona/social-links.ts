import type {
  PersonaSocialLink,
  PersonaSocialLinksDisplayMode,
} from "@/types/persona";

export interface ResolvedPersonaSocialLink extends PersonaSocialLink {
  platform:
    | "linkedin"
    | "instagram"
    | "x"
    | "github"
    | "youtube"
    | "facebook"
    | "threads"
    | "tiktok"
    | "telegram"
    | "whatsapp"
    | "website";
  hostname: string;
}

export function detectSocialPlatform(
  value: string,
): ResolvedPersonaSocialLink["platform"] {
  try {
    const hostname = new URL(value).hostname
      .replace(/^www\./, "")
      .toLowerCase();

    if (hostname.endsWith("linkedin.com")) {
      return "linkedin";
    }

    if (hostname.endsWith("instagram.com")) {
      return "instagram";
    }

    if (hostname === "x.com" || hostname.endsWith("twitter.com")) {
      return "x";
    }

    if (hostname.endsWith("github.com")) {
      return "github";
    }

    if (hostname.endsWith("youtube.com") || hostname === "youtu.be") {
      return "youtube";
    }

    if (hostname.endsWith("facebook.com")) {
      return "facebook";
    }

    if (hostname.endsWith("threads.net")) {
      return "threads";
    }

    if (hostname.endsWith("tiktok.com")) {
      return "tiktok";
    }

    if (hostname.endsWith("telegram.me") || hostname.endsWith("t.me")) {
      return "telegram";
    }

    if (hostname.endsWith("wa.me") || hostname.endsWith("whatsapp.com")) {
      return "whatsapp";
    }
  } catch {
    return "website";
  }

  return "website";
}

export function getDefaultSocialTitle(value: string): string {
  const platform = detectSocialPlatform(value);

  switch (platform) {
    case "linkedin":
      return "LinkedIn";
    case "instagram":
      return "Instagram";
    case "x":
      return "X";
    case "github":
      return "GitHub";
    case "youtube":
      return "YouTube";
    case "facebook":
      return "Facebook";
    case "threads":
      return "Threads";
    case "tiktok":
      return "TikTok";
    case "telegram":
      return "Telegram";
    case "whatsapp":
      return "WhatsApp";
    case "website": {
      try {
        return new URL(value).hostname.replace(/^www\./, "");
      } catch {
        return "Website";
      }
    }
  }
}

export function resolveSocialLinks(
  socialLinks: ReadonlyArray<PersonaSocialLink>,
): ResolvedPersonaSocialLink[] {
  return socialLinks.flatMap((socialLink) => {
    try {
      const url = new URL(socialLink.url);

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return [];
      }

      return [
        {
          ...socialLink,
          url: url.toString(),
          platform: detectSocialPlatform(url.toString()),
          hostname: url.hostname.replace(/^www\./, ""),
        },
      ];
    } catch {
      return [];
    }
  });
}

export function getVisibleSocialLinks(
  socialLinks: ReadonlyArray<PersonaSocialLink>,
  displayMode: PersonaSocialLinksDisplayMode,
): ResolvedPersonaSocialLink[] {
  const resolvedLinks = resolveSocialLinks(socialLinks);
  return resolvedLinks.slice(0, displayMode === "icons" ? 5 : 3);
}

export function hasOverflowSocialLinks(
  socialLinks: ReadonlyArray<PersonaSocialLink>,
  displayMode: PersonaSocialLinksDisplayMode,
): boolean {
  const limit = displayMode === "icons" ? 5 : 3;
  return resolveSocialLinks(socialLinks).length > limit;
}
