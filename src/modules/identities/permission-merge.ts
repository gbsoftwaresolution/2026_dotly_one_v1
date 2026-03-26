import { PermissionEffect } from "../../common/enums/permission-effect.enum";
import { TrustState } from "../../common/enums/trust-state.enum";

import type {
  ConnectionPolicyTemplateLimits,
  ConnectionPolicyTemplatePermissions,
  MergeMode,
  PermissionMergeReasonCode,
  PermissionMergeTrace,
  PermissionMergeTraceEntry,
  PermissionTemplateValue,
  TrustAdjustedPermissionsResult,
  TrustStateAdjustmentDefinition,
} from "./identity.types";
import { CORE_CONNECTION_TEMPLATE_PERMISSION_KEYS } from "./identity.types";
import { PERMISSION_KEYS } from "./permission-keys";
import { getTrustStateAdjustmentDefinition } from "./trust-state-adjustments";

const EFFECT_RANK: Record<PermissionEffect, number> = {
  [PermissionEffect.Deny]: 0,
  [PermissionEffect.RequestApproval]: 1,
  [PermissionEffect.AllowWithLimits]: 2,
  [PermissionEffect.Allow]: 3,
};

const HARD_DENY_SENSITIVE_KEYS = new Set([
  `${PERMISSION_KEYS.mediaPrivacy.export}:${TrustState.TrustedByUser}`,
  `${PERMISSION_KEYS.mediaPrivacy.export}:${TrustState.StrongVerified}`,
  `${PERMISSION_KEYS.mediaPrivacy.export}:${TrustState.BasicVerified}`,
  `${PERMISSION_KEYS.vault.itemReshare}:${TrustState.TrustedByUser}`,
  `${PERMISSION_KEYS.vault.itemReshare}:${TrustState.StrongVerified}`,
  `${PERMISSION_KEYS.vault.itemReshare}:${TrustState.BasicVerified}`,
]);

export function mergePermissionEffect(
  baseEffect: PermissionEffect,
  adjustmentEffect: PermissionEffect,
  mergeMode: MergeMode,
): PermissionEffect {
  if (mergeMode === "RESTRICTIVE") {
    return EFFECT_RANK[adjustmentEffect] < EFFECT_RANK[baseEffect]
      ? adjustmentEffect
      : baseEffect;
  }

  return EFFECT_RANK[adjustmentEffect] > EFFECT_RANK[baseEffect]
    ? adjustmentEffect
    : baseEffect;
}

export function mergePermissionValue(
  baseValue: PermissionTemplateValue,
  adjustmentValue: PermissionTemplateValue,
  mergeMode: MergeMode,
): PermissionTemplateValue {
  const mergedEffect = mergePermissionEffect(
    baseValue.effect,
    adjustmentValue.effect,
    mergeMode,
  );
  const limits = mergeLimits(
    baseValue.limits,
    adjustmentValue.limits,
    mergedEffect,
  );

  return limits ? { effect: mergedEffect, limits } : { effect: mergedEffect };
}

export function mergePermissionMap(
  basePermissions: ConnectionPolicyTemplatePermissions,
  adjustmentPermissions: Partial<ConnectionPolicyTemplatePermissions>,
  mergeMode: MergeMode,
  trustState: TrustState,
): TrustAdjustedPermissionsResult {
  const mergedPermissions = {
    ...basePermissions,
  } as ConnectionPolicyTemplatePermissions;
  const mergeTrace = {} as PermissionMergeTrace;

  for (const permissionKey of CORE_CONNECTION_TEMPLATE_PERMISSION_KEYS) {
    const baseValue = basePermissions[permissionKey];
    const adjustmentValue = adjustmentPermissions[permissionKey];

    if (!adjustmentValue) {
      mergeTrace[permissionKey] = createTraceEntry(
        baseValue.effect,
        null,
        baseValue.effect,
        mergeMode,
        "TRUST_NO_CHANGE",
      );
      continue;
    }

    const hardSensitiveDeny =
      baseValue.effect === PermissionEffect.Deny &&
      mergeMode === "PERMISSIVE" &&
      HARD_DENY_SENSITIVE_KEYS.has(`${permissionKey}:${trustState}`);

    const mergedValue = hardSensitiveDeny
      ? baseValue
      : mergePermissionValue(baseValue, adjustmentValue, mergeMode);

    mergedPermissions[permissionKey] = mergedValue;
    mergeTrace[permissionKey] = createTraceEntry(
      baseValue.effect,
      adjustmentValue.effect,
      mergedValue.effect,
      mergeMode,
      deriveReasonCode(baseValue, adjustmentValue, mergedValue, trustState),
    );
  }

  return {
    mergedPermissions,
    mergeTrace,
  };
}

export function applyTrustStateAdjustment(
  basePermissions: ConnectionPolicyTemplatePermissions,
  trustState: TrustState,
): TrustAdjustedPermissionsResult {
  const adjustmentDefinition = getTrustStateAdjustmentDefinition(trustState);

  return mergePermissionMap(
    basePermissions,
    adjustmentDefinition.permissions,
    adjustmentDefinition.mergeMode,
    trustState,
  );
}

function mergeLimits(
  baseLimits: PermissionTemplateValue["limits"],
  adjustmentLimits: PermissionTemplateValue["limits"],
  mergedEffect: PermissionEffect,
) {
  if (!baseLimits && !adjustmentLimits) {
    return undefined;
  }

  if (!adjustmentLimits) {
    return mergedEffect === PermissionEffect.AllowWithLimits
      ? baseLimits
      : baseLimits;
  }

  if (!baseLimits) {
    return adjustmentLimits;
  }

  return mergeLimitObjects(
    baseLimits as Record<string, unknown>,
    adjustmentLimits as Record<string, unknown>,
    mergedEffect,
  );
}

function deriveReasonCode(
  baseValue: PermissionTemplateValue,
  adjustmentValue: PermissionTemplateValue,
  mergedValue: PermissionTemplateValue,
  trustState: TrustState,
): PermissionMergeReasonCode {
  if (
    trustState === TrustState.Blocked &&
    mergedValue.effect === PermissionEffect.Deny
  ) {
    return "TRUST_BLOCKED";
  }

  if (baseValue.effect === mergedValue.effect) {
    if (baseValue.limits && adjustmentValue.limits) {
      return "TRUST_LIMITS_MERGED";
    }

    return adjustmentValue.effect === baseValue.effect
      ? "TEMPLATE_BASE"
      : "TRUST_NO_CHANGE";
  }

  return EFFECT_RANK[mergedValue.effect] > EFFECT_RANK[baseValue.effect]
    ? "TRUST_PROMOTED"
    : "TRUST_RESTRICTED";
}

function createTraceEntry(
  baseEffect: PermissionEffect,
  adjustmentEffect: PermissionEffect | null,
  finalEffect: PermissionEffect,
  mergeMode: MergeMode,
  reasonCode: PermissionMergeReasonCode,
): PermissionMergeTraceEntry {
  return {
    baseEffect,
    identityBehaviorEffect: null,
    postIdentityBehaviorEffect: baseEffect,
    relationshipBehaviorEffect: null,
    postRelationshipEffect: baseEffect,
    adjustmentEffect,
    postTrustEffect: finalEffect,
    manualOverrideEffect: null,
    preRiskEffect: finalEffect,
    riskAdjustmentEffect: null,
    finalEffect,
    mergeMode,
    overrideApplied: false,
    guardrailApplied: false,
    riskApplied: false,
    riskReasons: [],
    reasonCode,
  };
}

export function getTrustStateAdjustment(
  trustState: TrustState,
): TrustStateAdjustmentDefinition {
  return getTrustStateAdjustmentDefinition(trustState);
}

function mergeLimitObjects(
  baseLimits: Record<string, unknown>,
  adjustmentLimits: Record<string, unknown>,
  mergedEffect: PermissionEffect,
): ConnectionPolicyTemplateLimits | Record<string, unknown> {
  const mergedLimits: Record<string, unknown> = {
    ...baseLimits,
  };

  for (const [key, adjustmentValue] of Object.entries(adjustmentLimits)) {
    const baseValue = mergedLimits[key];

    if (
      typeof baseValue === "boolean" &&
      typeof adjustmentValue === "boolean"
    ) {
      mergedLimits[key] = baseValue && adjustmentValue;
      continue;
    }

    if (typeof baseValue === "number" && typeof adjustmentValue === "number") {
      mergedLimits[key] = Math.min(baseValue, adjustmentValue);
      continue;
    }

    if (typeof baseValue === "string" && typeof adjustmentValue === "string") {
      mergedLimits[key] =
        baseValue <= adjustmentValue ? baseValue : adjustmentValue;
      continue;
    }

    if (Array.isArray(baseValue) && Array.isArray(adjustmentValue)) {
      mergedLimits[key] = baseValue.filter((value) =>
        adjustmentValue.includes(value),
      );
      continue;
    }

    mergedLimits[key] = adjustmentValue;
  }

  if (
    mergedEffect === PermissionEffect.AllowWithLimits &&
    Object.keys(mergedLimits).length === 0
  ) {
    return baseLimits;
  }

  return mergedLimits;
}
