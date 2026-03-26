import { PermissionEffect } from "../../common/enums/permission-effect.enum";
import { RelationshipType } from "../../common/enums/relationship-type.enum";

import type {
  ConnectionPolicyTemplatePermissions,
  PermissionMergeTrace,
  PermissionTemplateValue,
} from "./identity.types";
import { CORE_CONNECTION_TEMPLATE_PERMISSION_KEYS } from "./identity.types";
import {
  getRelationshipBehavior,
  summarizeRelationshipBehavior,
  type RelationshipAdjustmentTrace,
  type RelationshipBehaviorSummary,
} from "./relationship-engine";
import type { PermissionKey } from "./permission-keys";
import { PERMISSION_KEYS } from "./permission-keys";

const EFFECT_RANK: Record<PermissionEffect, number> = {
  [PermissionEffect.Deny]: 0,
  [PermissionEffect.RequestApproval]: 1,
  [PermissionEffect.AllowWithLimits]: 2,
  [PermissionEffect.Allow]: 3,
};

const HARD_PRESERVE_KEYS = new Set<PermissionKey>([
  PERMISSION_KEYS.mediaPrivacy.export,
  PERMISSION_KEYS.vault.itemReshare,
  PERMISSION_KEYS.relationship.block,
  PERMISSION_KEYS.relationship.report,
]);

export function applyRelationshipBehavior(
  basePermissions: ConnectionPolicyTemplatePermissions,
  relationshipType: RelationshipType | null | undefined,
): {
  mergedPermissions: ConnectionPolicyTemplatePermissions;
  relationshipTrace: PermissionMergeTrace;
  relationshipSummary: RelationshipBehaviorSummary;
  adjustmentTrace: RelationshipAdjustmentTrace;
} {
  const behavior = getRelationshipBehavior(relationshipType);
  const relationshipSummary = summarizeRelationshipBehavior(relationshipType);
  const mergedPermissions = {
    ...basePermissions,
  } as ConnectionPolicyTemplatePermissions;
  const relationshipTrace = {} as PermissionMergeTrace;

  for (const permissionKey of CORE_CONNECTION_TEMPLATE_PERMISSION_KEYS) {
    const baseValue = basePermissions[permissionKey];
    const relationshipValue = behavior.permissionAdjustments[permissionKey];

    if (!relationshipValue) {
      relationshipTrace[permissionKey] = createTraceEntry(
        baseValue.effect,
        null,
        baseValue.effect,
        "RELATIONSHIP_NO_CHANGE",
      );
      continue;
    }

    const mergedValue = mergeRelationshipValue(
      baseValue,
      relationshipValue,
      permissionKey,
    );
    mergedPermissions[permissionKey] = mergedValue;
    relationshipTrace[permissionKey] = createTraceEntry(
      baseValue.effect,
      relationshipValue.effect,
      mergedValue.effect,
      mergedValue.effect === baseValue.effect
        ? "RELATIONSHIP_NO_CHANGE"
        : EFFECT_RANK[mergedValue.effect] > EFFECT_RANK[baseValue.effect]
          ? "RELATIONSHIP_PROMOTED"
          : "RELATIONSHIP_RESTRICTED",
    );
  }

  return {
    mergedPermissions,
    relationshipTrace,
    relationshipSummary,
    adjustmentTrace: {
      relationshipType: relationshipSummary.relationshipType,
      appliedKeys: relationshipSummary.appliedKeys,
      reasonCodes: relationshipSummary.reasonCodes,
    },
  };
}

function mergeRelationshipValue(
  baseValue: PermissionTemplateValue,
  relationshipValue: PermissionTemplateValue,
  permissionKey: PermissionKey,
): PermissionTemplateValue {
  if (
    HARD_PRESERVE_KEYS.has(permissionKey) &&
    baseValue.effect === PermissionEffect.Deny &&
    relationshipValue.effect !== PermissionEffect.Deny
  ) {
    return baseValue;
  }

  if (
    permissionKey === PERMISSION_KEYS.relationship.block ||
    permissionKey === PERMISSION_KEYS.relationship.report
  ) {
    return baseValue;
  }

  const effect =
    EFFECT_RANK[relationshipValue.effect] > EFFECT_RANK[baseValue.effect]
      ? relationshipValue.effect
      : EFFECT_RANK[relationshipValue.effect] < EFFECT_RANK[baseValue.effect]
        ? relationshipValue.effect
        : baseValue.effect;

  return {
    effect,
    ...(relationshipValue.limits
      ? { limits: relationshipValue.limits }
      : baseValue.limits
        ? { limits: baseValue.limits }
        : {}),
  };
}

function createTraceEntry(
  baseEffect: PermissionEffect,
  relationshipEffect: PermissionEffect | null,
  finalEffect: PermissionEffect,
  reasonCode:
    | "RELATIONSHIP_NO_CHANGE"
    | "RELATIONSHIP_PROMOTED"
    | "RELATIONSHIP_RESTRICTED",
) {
  return {
    baseEffect,
    identityBehaviorEffect: null,
    postIdentityBehaviorEffect: baseEffect,
    relationshipBehaviorEffect: relationshipEffect,
    postRelationshipEffect: finalEffect,
    adjustmentEffect: null,
    postTrustEffect: finalEffect,
    manualOverrideEffect: null,
    preRiskEffect: finalEffect,
    riskAdjustmentEffect: null,
    finalEffect,
    mergeMode: "PERMISSIVE" as const,
    overrideApplied: false,
    guardrailApplied:
      relationshipEffect !== null && finalEffect === PermissionEffect.Deny,
    riskApplied: false,
    riskReasons: [],
    reasonCode,
  };
}
