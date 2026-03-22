import type { ContactRequestSourceType } from "@/types/request";

import { formatDaysAgo, formatTimeAgoShort } from "./format-time-ago";

export function formatSourceLabel(
  sourceLabel: string | null | undefined,
  sourceType: ContactRequestSourceType,
): string {
  const trimmedLabel = sourceLabel?.trim();

  if (trimmedLabel) {
    return trimmedLabel;
  }

  switch (sourceType) {
    case "qr":
      return "QR";
    case "event":
      return "Event";
    case "profile":
    default:
      return "Profile";
  }
}

export function getRelationshipAgeDays(
  relationshipAgeDays: number | null | undefined,
  createdAt: string | null | undefined,
): number {
  if (
    typeof relationshipAgeDays === "number" &&
    Number.isFinite(relationshipAgeDays) &&
    relationshipAgeDays >= 0
  ) {
    return Math.floor(relationshipAgeDays);
  }

  if (!createdAt) {
    return 0;
  }

  const createdAtTimestamp = new Date(createdAt).getTime();

  if (Number.isNaN(createdAtTimestamp)) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((Date.now() - createdAtTimestamp) / (1000 * 60 * 60 * 24)),
  );
}

export function formatRelationshipAge(
  relationshipAgeDays: number | null | undefined,
  createdAt: string | null | undefined,
  variant: "long" | "compact" = "long",
): string {
  return formatDaysAgo(
    getRelationshipAgeDays(relationshipAgeDays, createdAt),
    variant,
  );
}

export function getRecentActivityLabel(
  isRecentlyActive: boolean,
  lastInteractionAt: string | null | undefined,
): string | null {
  if (!isRecentlyActive) {
    return null;
  }

  return formatTimeAgoShort(lastInteractionAt) ?? "Active recently";
}