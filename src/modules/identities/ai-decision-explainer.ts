import { PermissionEffect } from "../../common/enums/permission-effect.enum";

import { AIReasonCode, type AICapabilityDecision } from "./ai-permission";
import { PERMISSION_KEY_LABELS } from "./permission-debug";
import { RiskSignal } from "./risk-engine";

export interface AIDecisionExplanation {
  decision: AICapabilityDecision;
  summary: string;
  explanationText: string;
  outcome: "ALLOWED" | "DENIED" | "LIMITED";
  reasonCode: AIReasonCode;
  permissionKey: string | null;
  permissionLabel: string;
  humanReadableFactors: AIHumanReadableFactor[];
  trace: AIDecisionExplanationTrace;
}

export interface AIHumanReadableFactor {
  factor: string;
  effect: string;
  weight: "critical" | "high" | "normal" | "low";
  detail: string;
}

export interface AIDecisionExplanationTrace {
  decisionPoint: string;
  decidingFactor: string | null;
  appliedFactors: string[];
  finalEffect: string;
}

export function explainAIDecision(
  decision: AICapabilityDecision,
  conversationContext?: {
    conversationType?: string | null;
    conversationStatus?: string | null;
    stale?: boolean;
  },
): AIDecisionExplanation {
  const permissionLabel = decision.permissionKey
    ? (PERMISSION_KEY_LABELS[decision.permissionKey] ?? decision.permissionKey)
    : String(decision.capability);

  const humanReadableFactors = buildAIFactors(decision);
  const decidingFactor = findAIDecidingFactor(humanReadableFactors);

  const summary = buildAISummary(
    decision,
    permissionLabel,
    conversationContext,
  );
  let outcome: AIDecisionExplanation["outcome"];

  switch (decision.restrictionLevel) {
    case "FULL":
      outcome = "ALLOWED";
      break;
    case "DENIED":
      outcome = "DENIED";
      break;
    case "LIMITED":
      outcome = "LIMITED";
      break;
    default:
      outcome = "DENIED";
  }

  const trace = buildAITrace(decision, decidingFactor, humanReadableFactors);

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

export const explainAICapabilityDecision = explainAIDecision;

function buildAIFactors(
  decision: AICapabilityDecision,
): AIHumanReadableFactor[] {
  const factors: AIHumanReadableFactor[] = [];

  if (decision.reasonCode === AIReasonCode.DeniedContext) {
    factors.push({
      factor: "Actor validation",
      effect: "Denied",
      weight: "critical",
      detail: "The actor is not a participant in this conversation.",
    });
  }

  if (decision.trace.baseEffect !== null) {
    factors.push({
      factor: "Base AI permission",
      effect: formatEffect(decision.trace.baseEffect),
      weight: "high",
      detail: `${decision.permissionKey ?? String(decision.capability)} resolves to ${formatEffect(decision.trace.baseEffect)}.`,
    });
  }

  if (decision.trace.contentAiEffect !== null) {
    const isExplicitlyDisabled =
      decision.reasonCode === AIReasonCode.ExplicitlyDisabled;
    factors.push({
      factor: "Content AI access",
      effect: isExplicitlyDisabled
        ? "Denied"
        : formatEffect(decision.trace.contentAiEffect),
      weight: isExplicitlyDisabled ? "critical" : "normal",
      detail: isExplicitlyDisabled
        ? "Content explicitly disables AI access."
        : `Content rule sets AI access effect to ${formatEffect(decision.trace.contentAiEffect)}.`,
    });
  }

  if (decision.trace.vaultViewEffect !== null && decision.trace.vaultContent) {
    factors.push({
      factor: "Vault access",
      effect: formatEffect(decision.trace.vaultViewEffect),
      weight: "high",
      detail: `Vault view permission for this content: ${formatEffect(decision.trace.vaultViewEffect)}.`,
    });
  }

  const riskSignals = decision.trace.riskSignals ?? [];
  if (
    riskSignals.includes(RiskSignal.AiSafetyRisk) ||
    riskSignals.includes(RiskSignal.DeviceCompromised) ||
    riskSignals.includes(RiskSignal.HighFraudProbability)
  ) {
    factors.push({
      factor: "Risk signals (critical)",
      effect: "Denied",
      weight: "critical",
      detail: `Critical risk signals detected: ${riskSignals.join(", ")}. AI capability is blocked.`,
    });
  } else if (riskSignals.includes(RiskSignal.RateLimited)) {
    factors.push({
      factor: "Rate limiting",
      effect: "Limited",
      weight: "normal",
      detail: "AI capability is rate-limited. Requests may be throttled.",
    });
  } else if (riskSignals.length > 0) {
    factors.push({
      factor: "Risk signals",
      effect: "Detected",
      weight: "low",
      detail: `Risk signals present: ${riskSignals.join(", ")}.`,
    });
  }

  if (decision.trace.protectedContextApplied) {
    if (decision.capability === "EXTRACT_ACTIONS") {
      factors.push({
        factor: "Protected context",
        effect: "Denied",
        weight: "critical",
        detail: "Protected contexts explicitly deny AI action extraction.",
      });
    } else {
      factors.push({
        factor: "Protected context",
        effect: "Limited",
        weight: "normal",
        detail:
          "Protected contexts limit AI capabilities to view-only operations.",
      });
    }
  }

  if (decision.restrictionLevel === "LIMITED") {
    if (
      decision.reasonCode === AIReasonCode.Limited &&
      !decision.trace.protectedContextApplied &&
      !riskSignals.includes(RiskSignal.RateLimited)
    ) {
      factors.push({
        factor: "Permission limits",
        effect: "Limited",
        weight: "normal",
        detail: "AI capability is allowed but with applied limits.",
      });
    }
  }

  return factors;
}

function findAIDecidingFactor(factors: AIHumanReadableFactor[]): string | null {
  const critical = factors.find((f) => f.weight === "critical");
  if (critical) {
    return critical.factor;
  }
  const high = factors.find((f) => f.weight === "high");
  return high?.factor ?? null;
}

function buildAISummary(
  decision: AICapabilityDecision,
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
    if (decision.restrictionLevel === "LIMITED") {
      return `AI capability '${permissionLabel}' is allowed with restrictions (${detailParts}).`;
    }
    return `AI capability '${permissionLabel}' is fully allowed (${detailParts}).`;
  }

  switch (decision.reasonCode) {
    case AIReasonCode.DeniedContext:
      if (decision.trace.protectedContextApplied) {
        return `AI capability '${permissionLabel}' is denied by protected context (${detailParts}).`;
      }
      return `AI capability '${permissionLabel}' is denied: actor not in conversation (${detailParts}).`;
    case AIReasonCode.DeniedPermission:
      return `AI capability '${permissionLabel}' is denied by permission resolution (${detailParts}).`;
    case AIReasonCode.DeniedContentRule:
      return `AI capability '${permissionLabel}' is denied by content rules (${detailParts}).`;
    case AIReasonCode.DeniedVault:
      return `AI capability '${permissionLabel}' is denied because vault access is required (${detailParts}).`;
    case AIReasonCode.DeniedRisk:
      return `AI capability '${permissionLabel}' is denied by risk policy (${detailParts}).`;
    case AIReasonCode.ExplicitlyDisabled:
      return `AI capability '${permissionLabel}' is denied because content explicitly disables AI access (${detailParts}).`;
    default:
      return `AI capability '${permissionLabel}' is denied (${detailParts}).`;
  }
}

function buildAITrace(
  decision: AICapabilityDecision,
  decidingFactor: string | null,
  factors: AIHumanReadableFactor[],
): AIDecisionExplanationTrace {
  return {
    decisionPoint: decidingFactor ?? "Permission evaluation",
    decidingFactor,
    appliedFactors: factors.map((f) => f.factor),
    finalEffect: decision.restrictionLevel,
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
