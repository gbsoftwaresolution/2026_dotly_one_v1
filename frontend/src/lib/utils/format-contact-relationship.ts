import type { ContactRequestSourceType } from "@/types/request";
import type { ContactConnectionSource } from "@/types/contact";

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

export function formatConnectionContext(
  connectionSource: ContactConnectionSource | null | undefined,
  contextLabel: string | null | undefined,
  sourceType?: ContactRequestSourceType,
): string {
  const trimmedLabel = contextLabel?.trim();
  const resolvedConnectionSource =
    connectionSource ?? toConnectionSource(sourceType);

  switch (resolvedConnectionSource) {
    case "event":
      return trimmedLabel ? `Met at ${trimmedLabel}` : "Met at an event";
    case "qr":
      return trimmedLabel ? `Connected via ${trimmedLabel}` : "Connected via QR";
    case "manual":
      return trimmedLabel ? `Connected during ${trimmedLabel}` : "Connected manually";
    case "unknown":
    default:
      return trimmedLabel ?? "Connected";
  }
}

export function getRelationshipAgeDays(
  relationshipAgeDays: number | null | undefined,
  connectedAt: string | null | undefined,
): number {
  if (
    typeof relationshipAgeDays === "number" &&
    Number.isFinite(relationshipAgeDays) &&
    relationshipAgeDays >= 0
  ) {
    return Math.floor(relationshipAgeDays);
  }

  if (!connectedAt) {
    return 0;
  }

  const connectedAtTimestamp = new Date(connectedAt).getTime();

  if (Number.isNaN(connectedAtTimestamp)) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((Date.now() - connectedAtTimestamp) / (1000 * 60 * 60 * 24)),
  );
}

export function formatRelationshipAge(
  relationshipAgeDays: number | null | undefined,
  connectedAt: string | null | undefined,
  variant: "long" | "compact" = "long",
): string {
  return formatDaysAgo(
    getRelationshipAgeDays(relationshipAgeDays, connectedAt),
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

function toConnectionSource(
  sourceType: ContactRequestSourceType | null | undefined,
): ContactConnectionSource {
  switch (sourceType) {
    case "qr":
      return "qr";
    case "event":
      return "event";
    case "profile":
      return "manual";
    default:
      return "unknown";
  }
}