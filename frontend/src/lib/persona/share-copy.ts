import type { PersonaSharePreferredShareType, QrType } from "@/types/persona";

type ShareLikeType = PersonaSharePreferredShareType | QrType | null | undefined;

function isInstantConnect(type: ShareLikeType): boolean {
  return type === "instant_connect" || type === "quick_connect";
}

export function getShareInstruction(type: ShareLikeType): string {
  return isInstantConnect(type)
    ? "Scan to connect with me on Dotly"
    : "Scan to open my Dotly";
}

export function getShareHeadline(type: ShareLikeType): string {
  return isInstantConnect(type)
    ? "Connect without sharing your number"
    : "A better first impression than a phone number";
}

export function getShareDescription(type: ShareLikeType): string {
  return isInstantConnect(type)
    ? "They scan once, preview your Dotly, and connect on their terms."
    : "They scan once, land on your Dotly, and choose the right next step.";
}
