import { PermissionEffect } from "../../common/enums/permission-effect.enum";
import { TrustState } from "../../common/enums/trust-state.enum";

import type {
  ConnectionPolicyTemplatePermissions,
  CoreConnectionTemplatePermissionKey,
  ManualOverrideGuardrailDecision,
  ManualOverrideMap,
  ManualOverrideValue,
  OverrideAdjustedPermissionsResult,
  PermissionMergeTrace,
  PermissionMergeTraceEntry,
  PermissionTemplateValue,
} from "./identity.types";
import { PERMISSION_KEYS } from "./permission-keys";

const BLOCKED_TRUST_HARD_DENY_KEYS = new Set<string>([
  PERMISSION_KEYS.messaging.textSend,
  PERMISSION_KEYS.messaging.voiceSend,
  PERMISSION_KEYS.messaging.imageSend,
  PERMISSION_KEYS.messaging.videoSend,
  PERMISSION_KEYS.messaging.documentSend,
  PERMISSION_KEYS.calling.voiceStart,
  PERMISSION_KEYS.calling.videoStart,
  PERMISSION_KEYS.vault.itemView,
  PERMISSION_KEYS.vault.itemDownload,
  PERMISSION_KEYS.ai.summaryUse,
  PERMISSION_KEYS.ai.replyUse,
]);

const PRESERVED_SYSTEM_ALLOW_KEYS = new Set<string>([
  PERMISSION_KEYS.relationship.block,
  PERMISSION_KEYS.relationship.report,
]);

export function mergeManualOverrideEffect(
  baseEffect: PermissionEffect,
  overrideEffect: PermissionEffect,
): PermissionEffect {
  return overrideEffect ?? baseEffect;
}

export function mergeManualOverrideValue(
  baseValue: PermissionTemplateValue,
  overrideValue: ManualOverrideValue,
): PermissionTemplateValue {
  const mergedEffect = mergeManualOverrideEffect(
    baseValue.effect,
    overrideValue.effect,
  );

  if (
    mergedEffect === PermissionEffect.AllowWithLimits &&
    baseValue.limits &&
    overrideValue.limits
  ) {
    return {
      effect: PermissionEffect.AllowWithLimits,
      limits: mergeLimitsConservatively(
        baseValue.limits as Record<string, unknown>,
        overrideValue.limits as Record<string, unknown>,
      ),
    };
  }

  return {
    effect: mergedEffect,
    ...(overrideValue.limits
      ? {
          limits:
            mergedEffect === PermissionEffect.AllowWithLimits &&
            baseValue.limits
              ? mergeLimitsConservatively(
                  baseValue.limits as Record<string, unknown>,
                  overrideValue.limits as Record<string, unknown>,
                )
              : overrideValue.limits,
        }
      : baseValue.limits
        ? { limits: baseValue.limits }
        : {}),
  };
}

export function applyManualOverrides(
  basePermissions: ConnectionPolicyTemplatePermissions,
  overrides: ManualOverrideMap,
  options: {
    trustState: TrustState;
    templateKey: string;
    mergeTrace: PermissionMergeTrace;
  },
): OverrideAdjustedPermissionsResult {
  const mergedPermissions = {
    ...basePermissions,
  } as ConnectionPolicyTemplatePermissions;
  const mergeTrace = {
    ...options.mergeTrace,
  } as PermissionMergeTrace;

  for (const [permissionKey, overrideValue] of Object.entries(overrides)) {
    if (!overrideValue) {
      continue;
    }

    const typedPermissionKey =
      permissionKey as CoreConnectionTemplatePermissionKey;
    const baseValue = mergedPermissions[typedPermissionKey];

    if (!baseValue) {
      continue;
    }

    const guardrailDecision = evaluateManualOverrideGuardrail(
      typedPermissionKey,
      baseValue,
      overrideValue,
      options.trustState,
      options.templateKey,
    );

    if (guardrailDecision.blocked) {
      mergeTrace[typedPermissionKey] = createOverrideTraceEntry(
        mergeTrace[typedPermissionKey],
        baseValue.effect,
        false,
        guardrailDecision.reasonCode!,
      );
      continue;
    }

    const mergedValue = mergeManualOverrideValue(baseValue, overrideValue);
    mergedPermissions[typedPermissionKey] = mergedValue;
    mergeTrace[typedPermissionKey] = createOverrideTraceEntry(
      mergeTrace[typedPermissionKey],
      mergedValue.effect,
      true,
      mergedValue.effect === PermissionEffect.AllowWithLimits &&
        baseValue.limits &&
        overrideValue.limits
        ? "OVERRIDE_LIMITS_MERGED"
        : mergedValue.effect === baseValue.effect
          ? "OVERRIDE_NO_CHANGE"
          : "OVERRIDE_APPLIED",
      overrideValue.effect,
    );
  }

  return {
    mergedPermissions,
    mergeTrace,
  };
}

function evaluateManualOverrideGuardrail(
  permissionKey: CoreConnectionTemplatePermissionKey,
  baseValue: PermissionTemplateValue,
  overrideValue: ManualOverrideValue,
  trustState: TrustState,
  templateKey: string,
): ManualOverrideGuardrailDecision {
  if (
    trustState === TrustState.Blocked &&
    baseValue.effect === PermissionEffect.Deny &&
    BLOCKED_TRUST_HARD_DENY_KEYS.has(permissionKey) &&
    overrideValue.effect !== PermissionEffect.Deny
  ) {
    return {
      blocked: true,
      reasonCode: "OVERRIDE_SKIPPED_HARD_DENY",
    };
  }

  if (
    templateKey === "couple.partner" &&
    baseValue.effect === PermissionEffect.Deny &&
    COUPLE_PARTNER_HARD_DENY_KEYS.has(permissionKey) &&
    overrideValue.effect !== PermissionEffect.Deny
  ) {
    return {
      blocked: true,
      reasonCode: "OVERRIDE_BLOCKED_BY_GUARDRAIL",
    };
  }

  if (
    PRESERVED_SYSTEM_ALLOW_KEYS.has(permissionKey) &&
    baseValue.effect === PermissionEffect.Allow &&
    overrideValue.effect !== PermissionEffect.Allow
  ) {
    return {
      blocked: true,
      reasonCode: "OVERRIDE_PRESERVED_SYSTEM_PERMISSION",
    };
  }

  return {
    blocked: false,
    reasonCode: null,
  };
}

const COUPLE_PARTNER_HARD_DENY_KEYS = new Set<string>([
  PERMISSION_KEYS.mediaPrivacy.export,
  PERMISSION_KEYS.vault.itemReshare,
]);

function createOverrideTraceEntry(
  existingTrace: PermissionMergeTraceEntry | undefined,
  finalEffect: PermissionEffect,
  overrideApplied: boolean,
  reasonCode:
    | "OVERRIDE_NO_CHANGE"
    | "OVERRIDE_APPLIED"
    | "OVERRIDE_LIMITS_MERGED"
    | "OVERRIDE_BLOCKED_BY_GUARDRAIL"
    | "OVERRIDE_SKIPPED_HARD_DENY"
    | "OVERRIDE_PRESERVED_SYSTEM_PERMISSION",
  manualOverrideEffect?: PermissionEffect,
): PermissionMergeTraceEntry {
  return {
    baseEffect: existingTrace?.baseEffect ?? finalEffect,
    adjustmentEffect: existingTrace?.adjustmentEffect ?? null,
    postTrustEffect:
      existingTrace?.postTrustEffect ??
      existingTrace?.finalEffect ??
      finalEffect,
    manualOverrideEffect: manualOverrideEffect ?? null,
    finalEffect,
    mergeMode: existingTrace?.mergeMode ?? "RESTRICTIVE",
    overrideApplied,
    guardrailApplied:
      reasonCode === "OVERRIDE_BLOCKED_BY_GUARDRAIL" ||
      reasonCode === "OVERRIDE_SKIPPED_HARD_DENY" ||
      reasonCode === "OVERRIDE_PRESERVED_SYSTEM_PERMISSION",
    reasonCode,
  };
}

function mergeLimitsConservatively(
  baseLimits: Record<string, unknown>,
  overrideLimits: Record<string, unknown>,
) {
  const mergedLimits: Record<string, unknown> = {
    ...baseLimits,
  };

  for (const [key, overrideValue] of Object.entries(overrideLimits)) {
    const baseValue = mergedLimits[key];

    if (typeof baseValue === "boolean" && typeof overrideValue === "boolean") {
      mergedLimits[key] = baseValue && overrideValue;
      continue;
    }

    if (typeof baseValue === "number" && typeof overrideValue === "number") {
      mergedLimits[key] = Math.min(baseValue, overrideValue);
      continue;
    }

    if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
      mergedLimits[key] = baseValue.filter((value) =>
        overrideValue.includes(value),
      );
      continue;
    }

    mergedLimits[key] = overrideValue;
  }

  return mergedLimits;
}
