import type { PublicPersonaTrust } from "@/types/persona";
import { dotlyPositioning } from "@/lib/constants/positioning";

export function getPublicTrustPresentation(trust: PublicPersonaTrust) {
  if (!trust.isVerified) {
    return null;
  }

  if (trust.isStrongVerified) {
    return {
      shortLabel: dotlyPositioning.publicProfile.verifiedLabel,
      detail:
        "Dotly verified both an email address and a mobile number for this profile.",
    };
  }

  return {
    shortLabel: dotlyPositioning.publicProfile.verifiedLabel,
    detail:
      "Dotly verified either an email address or a mobile number for this profile.",
  };
}