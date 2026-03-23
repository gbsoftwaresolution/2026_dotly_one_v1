import type { PersonaSharePreferredShareType, QrType } from "@/types/persona";

type ShareLikeType = PersonaSharePreferredShareType | QrType | null | undefined;

function isInstantConnect(type: ShareLikeType): boolean {
  return type === "instant_connect" || type === "quick_connect";
}

export function getShareInstruction(type: ShareLikeType): string {
  return isInstantConnect(type)
    ? "Scan to connect on Dotly"
    : "Scan to view my Dotly";
}

export function getShareHeadline(type: ShareLikeType): string {
  return isInstantConnect(type) ? "Ready to connect" : "Ready to share";
}

export function getShareDescription(type: ShareLikeType): string {
  return isInstantConnect(type)
    ? "They scan once and connect right away."
    : "They scan once and land on your Dotly card.";
}
