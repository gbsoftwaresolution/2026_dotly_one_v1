import { PermissionEffect } from "../../common/enums/permission-effect.enum";

import type {
  CallPermissionDecision,
  CallDecisionReasonCode,
  CallPermissionDefinition,
} from "./call-permission";
import {
  CallDecisionEffect,
  getCallPermissionDefinition,
} from "./call-permission";
import { PERMISSION_KEY_LABELS } from "./permission-debug";

export interface CallDecisionExplanation {
  decision: CallPermissionDecision;
  summary: string;
  explanationText: string;
  outcome: "ALLOWED" | "DENIED" | "REQUIRES_APPROVAL" | "LIMITED";
  reasonCode: CallDecisionReasonCode;
  permissionKey: string | null;
  permissionLabel: string;
  humanReadableFactors: CallHumanReadableFactor[];
  trace: CallDecisionExplanationTrace;
}

export interface CallHumanReadableFactor {
  factor: string;
  effect: string;
  weight: "critical" | "high" | "normal" | "low";
  detail: string;
}

export interface CallDecisionExplanationTrace {
  decisionPoint: string;
  decidingFactor: string | null;
  appliedFactors: string[];
  finalEffect: string;
}

export function explainCallDecision(
  decision: CallPermissionDecision,
  conversationContext?: {
    conversationType?: string | null;
    conversationStatus?: string | null;
    stale?: boolean;
  },
): CallDecisionExplanation {
  const callDefinition = getCallPermissionDefinition(
    decision.callType,
    decision.initiationMode,
  );
  const permissionLabel = callDefinition
    ? (PERMISSION_KEY_LABELS[callDefinition.permissionKey] ??
      callDefinition.permissionKey)
    : `${decision.callType} ${decision.initiationMode}`;

  const humanReadableFactors = buildCallFactors(decision, callDefinition);
  const decidingFactor = findDecidingFactor(humanReadableFactors);

  const summary = buildCallSummary(
    decision,
    permissionLabel,
    conversationContext,
  );
  let outcome: CallDecisionExplanation["outcome"];

  switch (decision.effect) {
    case CallDecisionEffect.Allow:
      outcome = "ALLOWED";
      break;
    case CallDecisionEffect.Deny:
      outcome = "DENIED";
      break;
    case CallDecisionEffect.RequestApproval:
      outcome = "REQUIRES_APPROVAL";
      break;
    case CallDecisionEffect.AllowWithLimits:
      outcome = "LIMITED";
      break;
    default:
      outcome = "DENIED";
  }

  const trace = buildCallTrace(decision, decidingFactor, humanReadableFactors);

  return {
    decision,
    summary,
    explanationText: summary,
    outcome,
    reasonCode: decision.reasonCode,
    permissionKey: decision.permissionKey,
    permissionLabel,
    humanReadableFactors,
    trace,
  };
}

function buildCallFactors(
  decision: CallPermissionDecision,
  callDefinition: CallPermissionDefinition | null,
): CallHumanReadableFactor[] {
  const factors: CallHumanReadableFactor[] = [];

  if (decision.reasonCode === "CALL_DENIED_INVALID_ACTOR") {
    factors.push({
      factor: "Actor validation",
      effect: "Denied",
      weight: "critical",
      detail: "The actor is not a participant in this conversation.",
    });
  }

  if (decision.reasonCode === "CALL_DENIED_CONVERSATION_STATE") {
    factors.push({
      factor: "Conversation state",
      effect: "Denied",
      weight: "critical",
      detail: "Conversation is not active. Calls are blocked.",
    });
  }

  if (decision.reasonCode === "CALL_DENIED_CALL_TYPE_UNSUPPORTED") {
    factors.push({
      factor: "Call type compatibility",
      effect: "Denied",
      weight: "critical",
      detail: `${decision.callType} calls with ${decision.initiationMode} mode are not supported.`,
    });
  }

  if (decision.reasonCode === "CALL_DENIED_IDENTITY_INCOMPATIBLE") {
    factors.push({
      factor: "Identity compatibility",
      effect: "Denied",
      weight: "critical",
      detail:
        "The identity pair does not support business calls in this context.",
    });
  }

  if (callDefinition) {
    const baseEffect = decision.trace.baseEffect;
    if (baseEffect !== null) {
      factors.push({
        factor: "Base permission",
        effect: formatEffect(baseEffect),
        weight: "high",
        detail: `${PERMISSION_KEY_LABELS[callDefinition.permissionKey] ?? callDefinition.permissionKey} resolves to ${formatEffect(baseEffect)}.`,
      });
    }
  }

  if (decision.trace.blockedCallsByRisk) {
    factors.push({
      factor: "Risk policy (all calls)",
      effect: "Denied",
      weight: "critical",
      detail: "Risk policy blocks all call types for this connection.",
    });
  }

  const runtime = decision.trace.runtimeRestrictions;
  if (runtime.strictExpectationUnknownRuntime) {
    factors.push({
      factor: "Runtime integrity",
      effect: "Denied",
      weight: "critical",
      detail:
        "Protected mode expectation is unknown at runtime. Call blocked for protected conversations.",
    });
  }

  if (runtime.screenCaptureDetected || runtime.castingDetected) {
    factors.push({
      factor: "Screen capture detected",
      effect: "Denied",
      weight: "critical",
      detail:
        "Screen capture or casting is active. Calls blocked in protected mode.",
    });
  }

  if (runtime.deviceIntegrityCompromised) {
    factors.push({
      factor: "Device integrity",
      effect: "Denied",
      weight: "critical",
      detail:
        "Device integrity is compromised. Calls blocked in protected mode.",
    });
  }

  if (runtime.protectedModeBlockedByRisk) {
    factors.push({
      factor: "Protected mode (risk)",
      effect: "Denied",
      weight: "high",
      detail: "Protected mode is blocked by risk policy.",
    });
  }

  if (decision.restrictionSummary.schedulingRequired) {
    if (decision.reasonCode === "CALL_DENIED_SCHEDULE_REQUIRED") {
      factors.push({
        factor: "Scheduling required",
        effect: "Denied",
        weight: "high",
        detail:
          "Direct calls are not allowed — scheduling is required for this connection.",
      });
    } else {
      factors.push({
        factor: "Scheduling bias",
        effect: "Restricted",
        weight: "normal",
        detail: "This connection has a scheduling bias for calls.",
      });
    }
  }

  if (decision.reasonCode === "CALL_REQUEST_REQUIRED") {
    factors.push({
      factor: "Initiation mode",
      effect: "Request approval",
      weight: "normal",
      detail: `${decision.initiationMode} mode requires approval.`,
    });
  }

  if (decision.trace.identityBehaviorApplied) {
    factors.push({
      factor: "Identity behavior",
      effect: "Adjusted",
      weight: "normal",
      detail: `Identity pair behavior affects call scheduling. Reasons: ${(decision.trace.identityBehaviorReasonCodes ?? []).join(", ") || "pair-specific rule"}.`,
    });
  }

  if (
    decision.restrictionSummary.directAllowed === false &&
    decision.initiationMode === "DIRECT"
  ) {
    factors.push({
      factor: "Direct call blocked",
      effect: "Denied",
      weight: "high",
      detail: "Direct calls are not allowed for this call type or mode.",
    });
  }

  return factors;
}

function findDecidingFactor(factors: CallHumanReadableFactor[]): string | null {
  const critical = factors.find((f) => f.weight === "critical");
  if (critical) {
    return critical.factor;
  }
  const high = factors.find((f) => f.weight === "high");
  return high?.factor ?? null;
}

function buildCallSummary(
  decision: CallPermissionDecision,
  permissionLabel: string,
  conversationContext?: {
    conversationType?: string | null;
    conversationStatus?: string | null;
    stale?: boolean;
  },
): string {
  const detailParts = [
    `reason=${decision.reasonCode}`,
    ...(decision.permissionKey ? [`permission=${decision.permissionKey}`] : []),
    ...(decision.reasons.length > 0
      ? [`details=${decision.reasons.join(" | ")}`]
      : []),
    ...(conversationContext?.conversationType
      ? [`conversationType=${conversationContext.conversationType}`]
      : []),
    ...(conversationContext?.conversationStatus
      ? [`conversationStatus=${conversationContext.conversationStatus}`]
      : []),
    ...(conversationContext?.stale === true ? ["binding=stale"] : []),
  ].join("; ");

  if (decision.allowed) {
    if (decision.effect === CallDecisionEffect.AllowWithLimits) {
      return `Call '${permissionLabel}' is allowed with limits (${detailParts}).`;
    }
    return `Call '${permissionLabel}' is allowed (${detailParts}).`;
  }

  switch (decision.reasonCode) {
    case "CALL_DENIED_INVALID_ACTOR":
      return `Call '${permissionLabel}' is denied: actor is not a participant (${detailParts}).`;
    case "CALL_DENIED_CONVERSATION_STATE":
      return `Call '${permissionLabel}' is denied by conversation state (${detailParts}).`;
    case "CALL_DENIED_CALL_TYPE_UNSUPPORTED":
      return `Call '${permissionLabel}' is denied: unsupported call type or mode (${detailParts}).`;
    case "CALL_DENIED_IDENTITY_INCOMPATIBLE":
      return `Call '${permissionLabel}' is denied: identity incompatibility (${detailParts}).`;
    case "CALL_DENIED_PROTECTED_MODE":
      return `Call '${permissionLabel}' is denied by protected mode restrictions (${detailParts}).`;
    case "CALL_DENIED_RISK":
      return `Call '${permissionLabel}' is denied by risk policy (${detailParts}).`;
    case "CALL_DENIED_SCHEDULE_REQUIRED":
      return `Call '${permissionLabel}' is denied because scheduling is required (${detailParts}).`;
    default:
      return `Call '${permissionLabel}' is denied (${detailParts}).`;
  }
}

function buildCallTrace(
  decision: CallPermissionDecision,
  decidingFactor: string | null,
  factors: CallHumanReadableFactor[],
): CallDecisionExplanationTrace {
  return {
    decisionPoint: decidingFactor ?? "Permission evaluation",
    decidingFactor,
    appliedFactors: factors.map((f) => f.factor),
    finalEffect: decision.effect,
  };
}

function formatEffect(effect: PermissionEffect | null): string {
  if (effect === null) {
    return "Not resolved";
  }
  switch (effect) {
    case PermissionEffect.Allow:
      return "Allow";
    case PermissionEffect.Deny:
      return "Deny";
    case PermissionEffect.RequestApproval:
      return "Request approval";
    case PermissionEffect.AllowWithLimits:
      return "Allow with limits";
  }
}
