import { PermissionEffect, ResolvedPermissionsMap } from "../types/connection";
import type { ResolvedPermissionsExplanation } from "../types/permissions";

export interface ProtectedActionState {
  label: string;
  effect: PermissionEffect;
  key: string;
}

export interface ProtectedRestrictions {
  isProtected: boolean;
  summaryText?: string;
  sharing: ProtectedActionState;
  exports: ProtectedActionState;
  ai: ProtectedActionState;
  calls: ProtectedActionState;
}

const DEFAULT_RESTRICTION: ProtectedActionState = {
  label: "Unknown",
  effect: PermissionEffect.Allow,
  key: "unknown",
};

function getEffect(
  map: ResolvedPermissionsMap | null,
  key: string,
  fallback: PermissionEffect,
): PermissionEffect {
  if (!map || !map.permissions || !map.permissions[key]) {
    return fallback;
  }
  return map.permissions[key].finalEffect;
}

export function getProtectedRestrictions(
  map: ResolvedPermissionsMap | null,
  explanation?: ResolvedPermissionsExplanation | null,
): ProtectedRestrictions {
  // Using relevant permission keys to define the restricted areas
  const sharingEffect = getEffect(
    map,
    "share.location.view",
    PermissionEffect.Deny,
  );
  const exportsEffect = getEffect(
    map,
    "media.document.send",
    PermissionEffect.AllowWithLimits,
  );
  const aiEffect = getEffect(
    map,
    "ai.summary.generate",
    PermissionEffect.Allow,
  );
  const callsEffect = getEffect(
    map,
    "call.video.initiate",
    PermissionEffect.RequestApproval,
  );

  // Consider it "Protected Mode" if any of these critical ones are restricted
  // or if we just want to flag it protected when the connection is strict.
  // We'll say it's protected if sharing or exports are denied or limited.
  const protectedPermissionKeys = new Set(
    explanation?.protectedPermissionKeys ?? [],
  );

  const isProtected =
    protectedPermissionKeys.size > 0 ||
    sharingEffect !== PermissionEffect.Allow ||
    exportsEffect !== PermissionEffect.Allow ||
    aiEffect !== PermissionEffect.Allow ||
    callsEffect !== PermissionEffect.Allow;

  return {
    isProtected,
    summaryText: explanation?.summaryText,
    sharing: {
      label: "Protected sharing",
      effect: sharingEffect,
      key: "share.location.view",
    },
    exports: {
      label: "Exports",
      effect: exportsEffect,
      key: "media.document.send",
    },
    ai: {
      label: "AI assistance",
      effect: aiEffect,
      key: "ai.summary.generate",
    },
    calls: {
      label: "Video calls",
      effect: callsEffect,
      key: "call.video.initiate",
    },
  };
}
