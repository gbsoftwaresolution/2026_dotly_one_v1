import { PermissionEffect } from "../../common/enums/permission-effect.enum";
import { IdentityType } from "../../common/enums/identity-type.enum";

import {
  getIdentityTypeBehavior,
  type IdentityTypeBehaviorSummary,
} from "./identity-type-behaviors";
import type {
  ConnectionPolicyTemplatePermissions,
  IdentityBehaviorAdjustedPermissionsResult,
  PermissionMergeTrace,
  PermissionTemplateValue,
} from "./identity.types";
import { CORE_CONNECTION_TEMPLATE_PERMISSION_KEYS } from "./identity.types";
import type { PermissionKey } from "./permission-keys";
import { PERMISSION_KEYS } from "./permission-keys";

const EFFECT_RANK: Record<PermissionEffect, number> = {
  [PermissionEffect.Deny]: 0,
  [PermissionEffect.RequestApproval]: 1,
  [PermissionEffect.AllowWithLimits]: 2,
  [PermissionEffect.Allow]: 3,
};

const ABSOLUTE_GUARDRAIL_KEYS = new Set<PermissionKey>([
  PERMISSION_KEYS.mediaPrivacy.export,
  PERMISSION_KEYS.vault.itemReshare,
  PERMISSION_KEYS.relationship.block,
  PERMISSION_KEYS.relationship.report,
]);

export function applyIdentityTypeBehavior(
  basePermissions: ConnectionPolicyTemplatePermissions,
  sourceIdentityType: IdentityType,
  targetIdentityType?: IdentityType | null,
): IdentityBehaviorAdjustedPermissionsResult {
  const { sourceBehavior, pairBehavior, summary } = getIdentityTypeBehavior(
    sourceIdentityType,
    targetIdentityType,
  );
  const mergedPermissions = {
    ...basePermissions,
  } as ConnectionPolicyTemplatePermissions;
  const mergeTrace = {} as PermissionMergeTrace;

  for (const permissionKey of CORE_CONNECTION_TEMPLATE_PERMISSION_KEYS) {
    const baseValue = basePermissions[permissionKey];
    const sourceAdjustment =
      sourceBehavior.permissionAdjustments[permissionKey];
    const pairAdjustment = pairBehavior?.permissionAdjustments[permissionKey];

    if (!sourceAdjustment && !pairAdjustment) {
      mergeTrace[permissionKey] = createBehaviorTraceEntry(
        baseValue.effect,
        null,
        baseValue.effect,
        "IDENTITY_BEHAVIOR_NO_CHANGE",
      );
      continue;
    }

    const afterSource = sourceAdjustment
      ? mergeBehaviorValue(baseValue, sourceAdjustment, permissionKey)
      : baseValue;
    const finalValue = pairAdjustment
      ? mergeBehaviorValue(afterSource, pairAdjustment, permissionKey)
      : afterSource;

    mergedPermissions[permissionKey] = finalValue;
    mergeTrace[permissionKey] = createBehaviorTraceEntry(
      baseValue.effect,
      pairAdjustment?.effect ?? sourceAdjustment?.effect ?? null,
      finalValue.effect,
      pairAdjustment
        ? "IDENTITY_PAIR_RULE_APPLIED"
        : EFFECT_RANK[finalValue.effect] > EFFECT_RANK[baseValue.effect]
          ? "IDENTITY_BEHAVIOR_PROMOTED"
          : finalValue.effect === baseValue.effect
            ? "IDENTITY_BEHAVIOR_NO_CHANGE"
            : "IDENTITY_BEHAVIOR_RESTRICTED",
    );
  }

  return {
    mergedPermissions,
    mergeTrace,
    behaviorSummary: summary,
  };
}

function mergeBehaviorValue(
  baseValue: PermissionTemplateValue,
  behaviorValue: PermissionTemplateValue,
  permissionKey: PermissionKey,
): PermissionTemplateValue {
  if (
    ABSOLUTE_GUARDRAIL_KEYS.has(permissionKey) &&
    baseValue.effect === PermissionEffect.Deny &&
    behaviorValue.effect !== PermissionEffect.Deny
  ) {
    return baseValue;
  }

  const effect =
    EFFECT_RANK[behaviorValue.effect] > EFFECT_RANK[baseValue.effect]
      ? behaviorValue.effect
      : baseValue.effect;
  const restrictiveEffect =
    EFFECT_RANK[behaviorValue.effect] < EFFECT_RANK[baseValue.effect]
      ? behaviorValue.effect
      : effect;
  const finalEffect =
    permissionKey === PERMISSION_KEYS.relationship.block ||
    permissionKey === PERMISSION_KEYS.relationship.report
      ? baseValue.effect
      : restrictiveEffect;

  return {
    effect: finalEffect,
    ...(behaviorValue.limits
      ? { limits: behaviorValue.limits }
      : baseValue.limits
        ? { limits: baseValue.limits }
        : {}),
  };
}

function createBehaviorTraceEntry(
  baseEffect: PermissionEffect,
  identityBehaviorEffect: PermissionEffect | null,
  finalEffect: PermissionEffect,
  reasonCode:
    | "IDENTITY_BEHAVIOR_NO_CHANGE"
    | "IDENTITY_BEHAVIOR_FLAG_ONLY"
    | "IDENTITY_BEHAVIOR_PROMOTED"
    | "IDENTITY_BEHAVIOR_RESTRICTED"
    | "IDENTITY_PAIR_RULE_APPLIED",
) {
  return {
    baseEffect,
    identityBehaviorEffect,
    postIdentityBehaviorEffect: finalEffect,
    relationshipBehaviorEffect: null,
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
      reasonCode === "IDENTITY_PAIR_RULE_APPLIED" &&
      finalEffect === PermissionEffect.Deny,
    riskApplied: false,
    riskReasons: [],
    reasonCode,
  };
}

export function createIdentityBehaviorFlagOnlyTrace(
  permissions: ConnectionPolicyTemplatePermissions,
  behaviorSummary: IdentityTypeBehaviorSummary,
): PermissionMergeTrace {
  const trace = {} as PermissionMergeTrace;

  for (const permissionKey of CORE_CONNECTION_TEMPLATE_PERMISSION_KEYS) {
    const baseValue = permissions[permissionKey];
    trace[permissionKey] = createBehaviorTraceEntry(
      baseValue.effect,
      null,
      baseValue.effect,
      behaviorSummary.reasonCodes.includes("IDENTITY_BEHAVIOR_OK")
        ? "IDENTITY_BEHAVIOR_FLAG_ONLY"
        : "IDENTITY_BEHAVIOR_NO_CHANGE",
    );
  }

  return trace;
}
