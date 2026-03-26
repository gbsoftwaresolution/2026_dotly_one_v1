import { PermissionEffect } from "../../common/enums/permission-effect.enum";

import type {
  ContentActionKey,
  ContentConnectionPermissionSubset,
  ContentPermissionResolution,
  ConnectionPolicyTemplatePermissions,
  ResolvedConnectionPermissions,
  ResolvedPermissionMap,
} from "./identity.types";
import type { PermissionKey } from "./permission-keys";
import { PERMISSION_KEYS } from "./permission-keys";

export const CONTENT_ACTION_KEYS = [
  "content.view",
  "content.download",
  "content.forward",
  "content.export",
  "content.screenshot",
  "content.record",
  "content.ai_access",
] as const satisfies readonly ContentActionKey[];

const CONTENT_PERMISSION_MAPPING: Record<ContentActionKey, readonly string[]> =
  {
    "content.view": [PERMISSION_KEYS.vault.itemView],
    "content.download": [PERMISSION_KEYS.vault.itemDownload],
    "content.forward": [
      PERMISSION_KEYS.vault.itemReshare,
      PERMISSION_KEYS.mediaPrivacy.forward,
    ],
    "content.export": [PERMISSION_KEYS.mediaPrivacy.export],
    "content.screenshot": [PERMISSION_KEYS.mediaPrivacy.screenshot],
    "content.record": [PERMISSION_KEYS.mediaPrivacy.screenRecord],
    "content.ai_access": [PERMISSION_KEYS.ai.summaryUse],
  };

export function deriveContentPermissionSubset(
  resolved: ResolvedConnectionPermissions,
): ContentConnectionPermissionSubset {
  return deriveContentPermissionSubsetFromResolvedPermissions(
    resolved.permissions,
  );
}

export function deriveContentPermissionSubsetFromResolvedPermissions(
  resolvedPermissions: ResolvedPermissionMap,
): ContentConnectionPermissionSubset {
  return deriveContentPermissionSubsetFromLookup(
    (permissionKey) => resolvedPermissions[permissionKey]?.finalEffect,
  );
}

export function deriveContentPermissionSubsetFromFinalPermissions(
  permissions: ConnectionPolicyTemplatePermissions,
): ContentConnectionPermissionSubset {
  return deriveContentPermissionSubsetFromLookup(
    (permissionKey) => permissions[permissionKey]?.effect,
  );
}

function deriveContentPermissionSubsetFromLookup(
  getEffect: (permissionKey: PermissionKey) => PermissionEffect | undefined,
): ContentConnectionPermissionSubset {
  return CONTENT_ACTION_KEYS.reduce<ContentConnectionPermissionSubset>(
    (accumulator, actionKey) => {
      const basePermissionKeys = CONTENT_PERMISSION_MAPPING[actionKey];
      const matchedPermissionKey = basePermissionKeys.find(
        (permissionKey) =>
          getEffect(permissionKey as PermissionKey) !== undefined,
      ) as PermissionKey | undefined;

      accumulator[actionKey] = {
        basePermissionKey:
          matchedPermissionKey ?? (basePermissionKeys[0] as PermissionKey),
        effect:
          (matchedPermissionKey
            ? getEffect(matchedPermissionKey)
            : undefined) ?? PermissionEffect.Deny,
        inheritedFromConnection: matchedPermissionKey !== undefined,
      };

      return accumulator;
    },
    {} as ContentConnectionPermissionSubset,
  );
}

export function deriveContentPermissionResolutions(
  subset: ContentConnectionPermissionSubset,
): Record<ContentActionKey, ContentPermissionResolution> {
  return CONTENT_ACTION_KEYS.reduce<
    Record<ContentActionKey, ContentPermissionResolution>
  >(
    (accumulator, actionKey) => {
      accumulator[actionKey] = {
        effect: subset[actionKey].effect,
      };

      return accumulator;
    },
    {} as Record<ContentActionKey, ContentPermissionResolution>,
  );
}
