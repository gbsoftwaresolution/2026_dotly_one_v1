import { PermissionEffect } from "../../common/enums/permission-effect.enum";
import { TrustState } from "../../common/enums/trust-state.enum";

import type {
  ConnectionPolicyTemplatePermissions,
  PermissionMergeTrace,
  PermissionTemplateValue,
  RiskEvaluationSummary,
} from "./identity.types";
import type { PermissionKey } from "./permission-keys";
import { PERMISSION_KEYS } from "./permission-keys";

export enum RiskSignal {
  DeviceCompromised = "DEVICE_COMPROMISED",
  SpamFlagged = "SPAM_FLAGGED",
  AbuseReported = "ABUSE_REPORTED",
  PaymentRisk = "PAYMENT_RISK",
  AiSafetyRisk = "AI_SAFETY_RISK",
  ScreenCaptureRisk = "SCREEN_CAPTURE_RISK",
  CastingRisk = "CASTING_RISK",
  HighFraudProbability = "HIGH_FRAUD_PROBABILITY",
  IdentityUnderReview = "IDENTITY_UNDER_REVIEW",
  RateLimited = "RATE_LIMITED",
}

export enum RiskSeverity {
  Low = "LOW",
  Medium = "MEDIUM",
  High = "HIGH",
  Critical = "CRITICAL",
}

export interface RiskSignalRecord {
  signal: RiskSignal;
  severity: RiskSeverity;
}

export interface RiskRestrictionSet {
  permissions: Partial<Record<string, PermissionTemplateValue>>;
  blockedProtectedMode?: boolean;
  blockedPayments?: boolean;
  blockedCalls?: boolean;
  aiRestricted?: boolean;
}

export interface RiskOverlayDecision {
  permissionKey: string;
  effect: PermissionEffect;
  signals: RiskSignal[];
}

export interface ApplyRiskOverlayResult {
  mergedPermissions: ConnectionPolicyTemplatePermissions;
  mergeTrace: PermissionMergeTrace;
  riskSummary: RiskEvaluationSummary;
}

const RISK_RESTRICTIONS: Record<RiskSignal, RiskRestrictionSet> = {
  [RiskSignal.DeviceCompromised]: {
    permissions: {
      [PERMISSION_KEYS.mediaPrivacy.protectedSend]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.mediaPrivacy.export]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.vault.itemView]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.vault.itemDownload]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.vault.itemReshare]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.calling.voiceStart]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.calling.videoStart]: { effect: PermissionEffect.Deny },
    },
    blockedProtectedMode: true,
    blockedCalls: true,
  },
  [RiskSignal.SpamFlagged]: {
    permissions: {
      [PERMISSION_KEYS.messaging.textSend]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.messaging.voiceSend]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.messaging.imageSend]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.messaging.videoSend]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.messaging.documentSend]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.calling.voiceStart]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.calling.videoStart]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.relationship.report]: { effect: PermissionEffect.Allow },
      [PERMISSION_KEYS.relationship.block]: { effect: PermissionEffect.Allow },
    },
    blockedCalls: true,
  },
  [RiskSignal.AbuseReported]: {
    permissions: {
      [PERMISSION_KEYS.calling.voiceStart]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.calling.videoStart]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.actions.paymentRequestCreate]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.actions.paymentExecute]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.ai.summaryUse]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.ai.replyUse]: { effect: PermissionEffect.Deny },
    },
    blockedCalls: true,
    blockedPayments: true,
    aiRestricted: true,
  },
  [RiskSignal.PaymentRisk]: {
    permissions: {
      [PERMISSION_KEYS.actions.paymentRequestCreate]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.actions.paymentExecute]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.actions.invoiceIssue]: { effect: PermissionEffect.Deny },
    },
    blockedPayments: true,
  },
  [RiskSignal.AiSafetyRisk]: {
    permissions: {
      [PERMISSION_KEYS.ai.summaryUse]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.ai.replyUse]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.ai.extractActionsUse]: { effect: PermissionEffect.Deny },
    },
    aiRestricted: true,
  },
  [RiskSignal.ScreenCaptureRisk]: {
    permissions: {
      [PERMISSION_KEYS.mediaPrivacy.protectedSend]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.mediaPrivacy.export]: { effect: PermissionEffect.Deny },
    },
    blockedProtectedMode: true,
  },
  [RiskSignal.CastingRisk]: {
    permissions: {
      [PERMISSION_KEYS.calling.videoStart]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.mediaPrivacy.protectedSend]: {
        effect: PermissionEffect.Deny,
      },
    },
    blockedCalls: true,
    blockedProtectedMode: true,
  },
  [RiskSignal.HighFraudProbability]: {
    permissions: {
      [PERMISSION_KEYS.actions.paymentRequestCreate]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.actions.paymentExecute]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.profile.phoneView]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.profile.emailView]: { effect: PermissionEffect.Deny },
    },
    blockedPayments: true,
  },
  [RiskSignal.IdentityUnderReview]: {
    permissions: {
      [PERMISSION_KEYS.actions.paymentRequestCreate]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.actions.paymentExecute]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.calling.directRing]: { effect: PermissionEffect.Deny },
    },
    blockedPayments: true,
  },
  [RiskSignal.RateLimited]: {
    permissions: {
      [PERMISSION_KEYS.messaging.textSend]: {
        effect: PermissionEffect.AllowWithLimits,
      },
      [PERMISSION_KEYS.calling.voiceStart]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.calling.videoStart]: { effect: PermissionEffect.Deny },
    },
    blockedCalls: true,
  },
};

const SEVERITY_RANK: Record<RiskSeverity, number> = {
  [RiskSeverity.Low]: 0,
  [RiskSeverity.Medium]: 1,
  [RiskSeverity.High]: 2,
  [RiskSeverity.Critical]: 3,
};

type TraceKey = PermissionKey;

export function deriveRiskSignalsFromTrustState(
  trustState: TrustState,
): RiskSignalRecord[] {
  if (trustState === TrustState.HighRisk) {
    return [
      {
        signal: RiskSignal.HighFraudProbability,
        severity: RiskSeverity.High,
      },
    ];
  }

  if (trustState === TrustState.Blocked) {
    return [
      {
        signal: RiskSignal.AbuseReported,
        severity: RiskSeverity.Critical,
      },
      {
        signal: RiskSignal.SpamFlagged,
        severity: RiskSeverity.Critical,
      },
    ];
  }

  return [];
}

export function applyRiskOverlay(
  basePermissions: ConnectionPolicyTemplatePermissions,
  riskSignals: RiskSignalRecord[],
  context: {
    mergeTrace: PermissionMergeTrace;
  },
): ApplyRiskOverlayResult {
  const mergedPermissions = {
    ...basePermissions,
  } as ConnectionPolicyTemplatePermissions;
  const mergeTrace = {
    ...context.mergeTrace,
  } as PermissionMergeTrace;

  const sortedSignals = [...riskSignals].sort(
    (left, right) =>
      SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity],
  );
  const candidatePermissionKeys = new Set<PermissionKey>([
    ...(Object.keys(basePermissions) as PermissionKey[]),
    ...sortedSignals.flatMap(
      (riskSignal) =>
        Object.keys(
          RISK_RESTRICTIONS[riskSignal.signal].permissions,
        ) as PermissionKey[],
    ),
  ]);

  for (const typedPermissionKey of candidatePermissionKeys) {
    const typedTraceKey = typedPermissionKey as TraceKey;
    const baseValue = basePermissions[typedPermissionKey];
    const applicableDecisions = sortedSignals
      .map((riskSignal) =>
        createRiskOverlayDecision(typedPermissionKey, riskSignal),
      )
      .filter((decision): decision is RiskOverlayDecision => decision !== null);

    const preserveSystemPermission =
      (typedPermissionKey === PERMISSION_KEYS.relationship.block ||
        typedPermissionKey === PERMISSION_KEYS.relationship.report) &&
      baseValue?.effect === PermissionEffect.Allow;

    if (preserveSystemPermission) {
      const existingTrace = mergeTrace[typedTraceKey];
      mergeTrace[typedTraceKey] = {
        ...ensureRiskTraceBase(existingTrace, baseValue?.effect),
        finalEffect: PermissionEffect.Allow,
        riskApplied: true,
        riskReasons: applicableDecisions.map((decision) => decision.signals[0]),
        guardrailApplied: true,
        reasonCode: "RISK_PRESERVED_SYSTEM_PERMISSION",
      };
      continue;
    }

    if (applicableDecisions.length === 0) {
      if (!baseValue) {
        continue;
      }

      const existingTrace = mergeTrace[typedTraceKey];
      mergeTrace[typedTraceKey] = {
        ...ensureRiskTraceBase(existingTrace, baseValue.effect),
        finalEffect: baseValue.effect,
        riskApplied: false,
        riskReasons: [],
        reasonCode: "RISK_NO_CHANGE",
      };
      continue;
    }

    const mostRestrictiveDecision = applicableDecisions.reduce(
      (current, candidate) =>
        effectRank(candidate.effect) < effectRank(current.effect)
          ? candidate
          : current,
    );
    const finalEffect =
      baseValue &&
      effectRank(baseValue.effect) < effectRank(mostRestrictiveDecision.effect)
        ? baseValue.effect
        : mostRestrictiveDecision.effect;

    mergedPermissions[typedPermissionKey] = {
      ...(baseValue ?? {}),
      effect: finalEffect,
    };
    const existingTrace = mergeTrace[typedTraceKey];
    mergeTrace[typedTraceKey] = {
      ...ensureRiskTraceBase(existingTrace, baseValue?.effect),
      riskAdjustmentEffect: mostRestrictiveDecision.effect,
      finalEffect,
      riskApplied: true,
      riskReasons: applicableDecisions.flatMap((decision) => decision.signals),
      reasonCode:
        applicableDecisions.length > 1
          ? "RISK_MULTI_SIGNAL_RESTRICTED"
          : finalEffect === PermissionEffect.Deny
            ? "RISK_BLOCKED"
            : "RISK_RESTRICTED",
    };
  }

  return {
    mergedPermissions,
    mergeTrace,
    riskSummary: summarizeRiskSignals(sortedSignals),
  };
}

export function createEmptyRiskSummary(): RiskEvaluationSummary {
  return {
    appliedSignals: [],
    highestSeverity: null,
    blockedProtectedMode: false,
    blockedPayments: false,
    blockedCalls: false,
    aiRestricted: false,
  };
}

function createRiskOverlayDecision(
  permissionKey: PermissionKey,
  riskSignal: RiskSignalRecord,
): RiskOverlayDecision | null {
  const restriction =
    RISK_RESTRICTIONS[riskSignal.signal].permissions[permissionKey];

  if (!restriction) {
    return null;
  }

  return {
    permissionKey,
    effect: restriction.effect,
    signals: [riskSignal.signal],
  };
}

function summarizeRiskSignals(
  riskSignals: RiskSignalRecord[],
): RiskEvaluationSummary {
  return {
    appliedSignals: [...new Set(riskSignals.map((signal) => signal.signal))],
    highestSeverity: riskSignals[0]?.severity ?? null,
    blockedProtectedMode: riskSignals.some(
      (signal) =>
        RISK_RESTRICTIONS[signal.signal].blockedProtectedMode === true,
    ),
    blockedPayments: riskSignals.some(
      (signal) => RISK_RESTRICTIONS[signal.signal].blockedPayments === true,
    ),
    blockedCalls: riskSignals.some(
      (signal) => RISK_RESTRICTIONS[signal.signal].blockedCalls === true,
    ),
    aiRestricted: riskSignals.some(
      (signal) => RISK_RESTRICTIONS[signal.signal].aiRestricted === true,
    ),
  };
}

function ensureRiskTraceBase(
  traceEntry: PermissionMergeTrace[TraceKey] | undefined,
  baseEffect?: PermissionEffect,
) {
  const fallbackEffect =
    baseEffect ?? traceEntry?.finalEffect ?? PermissionEffect.Deny;

  return {
    baseEffect: traceEntry?.baseEffect ?? fallbackEffect,
    identityBehaviorEffect: traceEntry?.identityBehaviorEffect ?? null,
    postIdentityBehaviorEffect:
      traceEntry?.postIdentityBehaviorEffect ??
      traceEntry?.postRelationshipEffect ??
      traceEntry?.postTrustEffect ??
      fallbackEffect,
    relationshipBehaviorEffect: traceEntry?.relationshipBehaviorEffect ?? null,
    postRelationshipEffect:
      traceEntry?.postRelationshipEffect ??
      traceEntry?.postIdentityBehaviorEffect ??
      traceEntry?.postTrustEffect ??
      fallbackEffect,
    adjustmentEffect: traceEntry?.adjustmentEffect ?? null,
    postTrustEffect: traceEntry?.postTrustEffect ?? fallbackEffect,
    manualOverrideEffect: traceEntry?.manualOverrideEffect ?? null,
    preRiskEffect:
      traceEntry?.preRiskEffect ?? traceEntry?.finalEffect ?? fallbackEffect,
    riskAdjustmentEffect: null,
    finalEffect: traceEntry?.finalEffect ?? fallbackEffect,
    mergeMode: traceEntry?.mergeMode ?? "RESTRICTIVE",
    overrideApplied: traceEntry?.overrideApplied ?? false,
    guardrailApplied: traceEntry?.guardrailApplied ?? false,
    riskApplied: traceEntry?.riskApplied ?? false,
    riskReasons: traceEntry?.riskReasons ?? [],
    reasonCode: traceEntry?.reasonCode ?? "RISK_NO_CHANGE",
  };
}

function effectRank(effect: PermissionEffect): number {
  switch (effect) {
    case PermissionEffect.Deny:
      return 0;
    case PermissionEffect.RequestApproval:
      return 1;
    case PermissionEffect.AllowWithLimits:
      return 2;
    case PermissionEffect.Allow:
      return 3;
  }

  throw new Error("Unsupported permission effect");
}
