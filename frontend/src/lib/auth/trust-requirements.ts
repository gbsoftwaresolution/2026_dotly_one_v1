import type { UserProfile, UserTrustRequirementKey } from "@/types/user";

type TrustAwareUser = Pick<UserProfile, "security">;

export function hasUnlockedTrustRequirement(
  user: TrustAwareUser | null | undefined,
  requirement: UserTrustRequirementKey,
): boolean {
  return (
    user?.security?.requirements.some(
      (candidate) => candidate.key === requirement && candidate.unlocked,
    ) ?? false
  );
}

export function hasAnyUnlockedTrustRequirement(
  user: TrustAwareUser | null | undefined,
): boolean {
  return (
    user?.security?.requirements.some((requirement) => requirement.unlocked) ??
    false
  );
}