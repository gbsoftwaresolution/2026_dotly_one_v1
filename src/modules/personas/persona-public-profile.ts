import { BadRequestException } from "@nestjs/common";
import { randomUUID } from "crypto";

import { PersonaSocialLinksDisplayMode } from "../../common/enums/persona-social-links-display-mode.enum";
import { PersonaSocialLinksDisplayMode as PrismaPersonaSocialLinksDisplayMode } from "../../generated/prisma/enums";

export interface PersonaSocialLink {
  id: string;
  title: string;
  url: string;
}

const SOCIAL_LINK_LIMIT = 50;
const SOCIAL_LINK_TITLE_MAX_LENGTH = 80;
const socialLinkDisplayModeMap: Record<
  PersonaSocialLinksDisplayMode,
  PrismaPersonaSocialLinksDisplayMode
> = {
  [PersonaSocialLinksDisplayMode.Buttons]:
    PrismaPersonaSocialLinksDisplayMode.BUTTONS,
  [PersonaSocialLinksDisplayMode.Icons]:
    PrismaPersonaSocialLinksDisplayMode.ICONS,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSuggestedSocialTitle(url: URL): string {
  const hostname = url.hostname.replace(/^www\./, "").toLowerCase();

  if (hostname.endsWith("linkedin.com")) {
    return "LinkedIn";
  }

  if (hostname.endsWith("instagram.com")) {
    return "Instagram";
  }

  if (hostname === "x.com" || hostname.endsWith("twitter.com")) {
    return "X";
  }

  if (hostname.endsWith("github.com")) {
    return "GitHub";
  }

  if (hostname.endsWith("youtube.com") || hostname === "youtu.be") {
    return "YouTube";
  }

  if (hostname.endsWith("facebook.com")) {
    return "Facebook";
  }

  if (hostname.endsWith("threads.net")) {
    return "Threads";
  }

  if (hostname.endsWith("tiktok.com")) {
    return "TikTok";
  }

  if (hostname.endsWith("telegram.me") || hostname.endsWith("t.me")) {
    return "Telegram";
  }

  if (hostname.endsWith("wa.me") || hostname.endsWith("whatsapp.com")) {
    return "WhatsApp";
  }

  return hostname;
}

function normalizeHttpUrl(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new BadRequestException(`${fieldName} must be a string`);
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.length > 500) {
    throw new BadRequestException(
      `${fieldName} must be 500 characters or less`,
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmedValue);
  } catch {
    throw new BadRequestException(`${fieldName} must be a valid URL`);
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new BadRequestException(`${fieldName} must use http or https`);
  }

  return parsedUrl.toString();
}

function isGoogleMapsHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();

  return (
    normalizedHost === "maps.app.goo.gl" ||
    normalizedHost === "maps.google.com" ||
    normalizedHost === "google.com" ||
    normalizedHost === "www.google.com"
  );
}

export function normalizeLocationAddress(
  value: unknown,
  fieldName = "locationAddress",
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new BadRequestException(`${fieldName} must be a string`);
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.length > 200) {
    throw new BadRequestException(
      `${fieldName} must be 200 characters or less`,
    );
  }

  return trimmedValue;
}

export function normalizeLocationMapUrl(
  value: unknown,
  fieldName = "locationMapUrl",
): string | null {
  const normalizedUrl = normalizeHttpUrl(value, fieldName);

  if (normalizedUrl === null) {
    return null;
  }

  const parsedUrl = new URL(normalizedUrl);

  if (!isGoogleMapsHost(parsedUrl.hostname)) {
    throw new BadRequestException(`${fieldName} must be a Google Maps link`);
  }

  return parsedUrl.toString();
}

export function normalizePersonaSocialLinks(
  value: unknown,
): PersonaSocialLink[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new BadRequestException("socialLinks must be an array");
  }

  if (value.length > SOCIAL_LINK_LIMIT) {
    throw new BadRequestException(
      `socialLinks must contain ${SOCIAL_LINK_LIMIT} entries or fewer`,
    );
  }

  const seenUrls = new Set<string>();

  return value.flatMap((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new BadRequestException(`socialLinks[${index}] must be an object`);
    }

    const normalizedUrl = normalizeHttpUrl(
      entry.url,
      `socialLinks[${index}].url`,
    );

    if (normalizedUrl === null) {
      return [];
    }

    if (seenUrls.has(normalizedUrl)) {
      throw new BadRequestException(`socialLinks[${index}].url must be unique`);
    }

    seenUrls.add(normalizedUrl);

    const titleValue =
      typeof entry.title === "string" ? entry.title.trim() : "";
    const normalizedTitle =
      titleValue || getSuggestedSocialTitle(new URL(normalizedUrl));

    if (normalizedTitle.length > SOCIAL_LINK_TITLE_MAX_LENGTH) {
      throw new BadRequestException(
        `socialLinks[${index}].title must be ${SOCIAL_LINK_TITLE_MAX_LENGTH} characters or less`,
      );
    }

    const idValue = typeof entry.id === "string" ? entry.id.trim() : "";

    return [
      {
        id: idValue || randomUUID(),
        title: normalizedTitle,
        url: normalizedUrl,
      },
    ];
  });
}

export function getSafePersonaSocialLinks(value: unknown): PersonaSocialLink[] {
  try {
    return normalizePersonaSocialLinks(value);
  } catch {
    return [];
  }
}

export function toPrismaSocialLinksDisplayMode(
  value?: PersonaSocialLinksDisplayMode | null,
): PrismaPersonaSocialLinksDisplayMode {
  return socialLinkDisplayModeMap[
    value ?? PersonaSocialLinksDisplayMode.Buttons
  ];
}

export function toApiSocialLinksDisplayMode(
  value: string | null | undefined,
): PersonaSocialLinksDisplayMode {
  return value === PrismaPersonaSocialLinksDisplayMode.ICONS ||
    value === PersonaSocialLinksDisplayMode.Icons
    ? PersonaSocialLinksDisplayMode.Icons
    : PersonaSocialLinksDisplayMode.Buttons;
}
